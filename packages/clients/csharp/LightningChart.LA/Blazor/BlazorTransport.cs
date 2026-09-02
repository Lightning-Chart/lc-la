using System.Threading.Channels;
using Microsoft.JSInterop;
using LightningChart.LA.Api;

namespace LightningChart.LA.Blazor;

/// <summary>
/// Transport for Blazor that uses IJSRuntime to call the LCLA host JS.
///
/// Messages are passed as raw byte arrays using .NET 8 optimized byte array
/// JS interop — no base64 encoding. Fire-and-forget messages are serialized
/// through a Channel queue so only one JS interop call is in flight at a time.
/// </summary>
public class BlazorTransport : ILclaTransport, ILclaErrorSource
{
    private readonly IJSRuntime _jsRuntime;
    private readonly Channel<byte[]> _queue = Channel.CreateUnbounded<byte[]>();

    public BlazorTransport(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
        _ = ProcessQueueAsync();
    }

    public event EventHandler<LclaErrorEventArgs>? ErrorOccurred;

    public async Task<byte[]> SendAsync(byte[] message, CancellationToken ct = default)
    {
        try
        {
            return await _jsRuntime.InvokeAsync<byte[]>(
                "window.__lcla_blazor.processMessage", ct, message);
        }
        catch (Exception exception)
        {
            throw Report(LclaErrorCategory.Communication, "LightningChart could not communicate with the chart area.", exception, false);
        }
    }

    public void SendFireAndForget(byte[] message)
    {
        _queue.Writer.TryWrite(message);
    }

    public void DiscardPending()
    {
        while (_queue.Reader.TryRead(out _)) { }
    }

    private async Task ProcessQueueAsync()
    {
        await foreach (var message in _queue.Reader.ReadAllAsync())
        {
            try
            {
                await _jsRuntime.InvokeVoidAsync("window.__lcla_blazor.processMessageFireAndForget", message);
            }
            catch (Exception exception)
            {
                Report(LclaErrorCategory.Data, "LightningChart could not apply chart data or configuration.", exception, false);
            }
        }
    }

    private LclaException Report(LclaErrorCategory category, string message, Exception innerException, bool canContinue)
    {
        var exception = new LclaException(category, message, innerException);
        ErrorOccurred?.Invoke(this, new LclaErrorEventArgs(exception, canContinue));
        return exception;
    }
}

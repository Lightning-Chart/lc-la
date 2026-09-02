using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading.Channels;
using LightningChart.LA.Api;
using LightningChart.LA.Bij;

namespace LightningChart.LA.WebView;

/// <summary>Serves a LightningChart page to a WebView using binary HTTP messages.</summary>
public sealed class WebViewTransport : ILclaTransport, ILclaErrorSource, IAsyncDisposable
{
    private const string HostScriptResource = "LightningChart.LA.Host.lcla-host.js";
    private static readonly TimeSpan ConnectionTimeout = TimeSpan.FromSeconds(20);
    private readonly TcpListener _listener;
    private readonly CancellationTokenSource _shutdown = new();
    private readonly ConcurrentDictionary<string, TaskCompletionSource<byte[]>> _responses = new();
    private readonly Channel<byte[]> _outgoing = Channel.CreateUnbounded<byte[]>();
    private readonly string _hostScript;
    private readonly Task _acceptLoop;

    private WebViewTransport(TcpListener listener, string hostScript)
    {
        _listener = listener;
        // The host bundle is a classic script. Keep its generated top-level names out of the
        // document scope: WebViews may retain that scope while reloading a local page.
        _hostScript = $"(() => {{\n{hostScript}\n}})();";
        Uri = new Uri($"http://127.0.0.1:{((IPEndPoint)listener.LocalEndpoint).Port}/");
        _acceptLoop = AcceptLoopAsync();
    }

    public Uri Uri { get; }

    public event EventHandler<LclaErrorEventArgs>? ErrorOccurred;

    public static Task<WebViewTransport> StartAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return Task.FromResult(new WebViewTransport(listener, LoadHostScript()));
    }

    public async Task<byte[]> SendAsync(byte[] message, CancellationToken ct = default)
    {
        var id = GetMessageId(message);
        var completion = new TaskCompletionSource<byte[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!_responses.TryAdd(id, completion)) throw new InvalidOperationException($"A chart request with id '{id}' is already pending.");
        try
        {
            if (!_outgoing.Writer.TryWrite(message)) throw new InvalidOperationException("The chart view is no longer available.");
            try
            {
                return await completion.Task.WaitAsync(ConnectionTimeout, ct).ConfigureAwait(false);
            }
            catch (TimeoutException exception)
            {
                throw new InvalidOperationException($"LightningChart could not connect to the WebView at {Uri} within {ConnectionTimeout.TotalSeconds:0} seconds.", exception);
            }
        }
        finally { _responses.TryRemove(id, out _); }
    }

    public void SendFireAndForget(byte[] message)
    {
        if (!_outgoing.Writer.TryWrite(message)) throw new InvalidOperationException("The chart view is no longer available.");
    }

    public void DiscardPending()
    {
        foreach (var response in _responses.Values) response.TrySetCanceled();
        _responses.Clear();
    }

    private async Task AcceptLoopAsync()
    {
        try { while (!_shutdown.IsCancellationRequested) _ = HandleClientAsync(await _listener.AcceptTcpClientAsync(_shutdown.Token).ConfigureAwait(false)); }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested) { }
        catch (ObjectDisposedException) when (_shutdown.IsCancellationRequested) { }
    }

    private async Task HandleClientAsync(TcpClient client)
    {
        await using var stream = client.GetStream();
        try
        {
            var request = await ReadRequestAsync(stream, _shutdown.Token).ConfigureAwait(false);
            if (request.Path == "/") await WriteHttpAsync(stream, "text/html; charset=utf-8", Encoding.UTF8.GetBytes(CreateHtml())).ConfigureAwait(false);
            else if (request.Path == "/lcla-host.js") await WriteHttpAsync(stream, "text/javascript; charset=utf-8", Encoding.UTF8.GetBytes(_hostScript)).ConfigureAwait(false);
            else if (request.Path == "/lcla-poll")
            {
                var message = await _outgoing.Reader.ReadAsync(_shutdown.Token).ConfigureAwait(false);
                var responseRequired = _responses.ContainsKey(GetMessageId(message));
                await WriteHttpAsync(stream, "application/octet-stream", message, responseRequired ? "X-Lcla-Response: 1\r\n" : null).ConfigureAwait(false);
            }
            else if (request.Path == "/lcla-response" && request.Headers.TryGetValue("Content-Length", out var lengthText) && int.TryParse(lengthText, out var length))
            {
                CompleteResponse(await ReadExactAsync(stream, length, _shutdown.Token).ConfigureAwait(false));
                await WriteNoContentAsync(stream).ConfigureAwait(false);
            }
            else if (request.Path == "/lcla-error" && request.Headers.TryGetValue("Content-Length", out var errorLengthText) && int.TryParse(errorLengthText, out var errorLength))
            {
                ReportClientError(Encoding.UTF8.GetString(await ReadExactAsync(stream, errorLength, _shutdown.Token).ConfigureAwait(false)));
                await WriteNoContentAsync(stream).ConfigureAwait(false);
            }
            else await WriteNotFoundAsync(stream).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested) { }
        catch (IOException) { }
        catch (Exception exception)
        {
            ReportClientError($"The local chart server failed: {exception.Message}");
        }
        finally { client.Dispose(); }
    }

    private void CompleteResponse(byte[] message)
    {
        var decoded = BijDecoder.Decode(message);
        var meta = (System.Text.Json.JsonElement)decoded["meta"];
        if (meta.TryGetProperty("type", out var type) && type.GetString() == "error")
        {
            ReportClientError(meta.TryGetProperty("error", out var error) ? error.GetString() ?? "Unknown chart error." : "Unknown chart error.");
            return;
        }

        var id = meta.GetProperty("id").GetString() ?? throw new InvalidOperationException("Chart response has no id.");
        if (_responses.TryGetValue(id, out var response)) response.TrySetResult(message);
    }

    private void ReportClientError(string message)
    {
        var exception = new LclaException(LclaErrorCategory.Host, $"LightningChart failed in the WebView: {message}");
        ErrorOccurred?.Invoke(this, new LclaErrorEventArgs(exception, false));
        foreach (var response in _responses.Values) response.TrySetException(exception);
    }

    private static string GetMessageId(byte[] message)
    {
        var decoded = BijDecoder.Decode(message);
        var meta = (System.Text.Json.JsonElement)decoded["meta"];
        return meta.GetProperty("id").GetString() ?? throw new InvalidOperationException("Chart message has no id.");
    }

    private static string CreateHtml() => CreateHtmlSource().Replace("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\">", string.Empty, StringComparison.Ordinal);

    private static string CreateHtmlSource() => """
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>html,body,#lcla-root{width:100%;height:100%;margin:0;overflow:hidden;background:#000}</style></head><body><div id="lcla-root"></div><script>let hostError;window.addEventListener('error',event=>{hostError=event.error?.stack||event.message||'Unknown script error.';});window.addEventListener('unhandledrejection',event=>{hostError=event.reason?.stack||String(event.reason);});</script><script src="/lcla-host.js"></script><script>function isError(response){try{const length=new DataView(response).getUint16(0,true);const parts=JSON.parse(new TextDecoder().decode(new Uint8Array(response,8,length)));const meta=parts.find(part=>part.key==='meta');const start=8+Math.ceil(length/8)*8+meta.start;return JSON.parse(new TextDecoder().decode(new Uint8Array(response,start,meta.length))).type==='error'}catch{return false}}async function report(error){try{await fetch('/lcla-error',{method:'POST',headers:{'Content-Type':'text/plain'},body:error instanceof Error?`${error.name}: ${error.stack||error.message}`:String(error)});}catch{}}async function run(){let stage='starting';try{if(!window.__lcla||typeof window.__lcla.processMessage!=='function')throw new Error(`LightningChart host did not initialize. ${hostError||'The host script did not expose its message handler.'}`);stage='waiting for a chart command';const poll=await fetch('/lcla-poll',{cache:'no-store'});stage='reading the chart command';const message=await poll.arrayBuffer();stage='processing the chart command';const response=window.__lcla.processMessage(message);if(poll.headers.get('X-Lcla-Response')==='1'||isError(response)){stage='sending the chart response';await fetch('/lcla-response',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:response});}}catch(error){await report(new Error(`LightningChart WebView failed while ${stage}: ${error?.stack||error}`));await new Promise(resolve=>setTimeout(resolve,250));}run();}run();</script></body></html>
""";

    private static string LoadHostScript()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(HostScriptResource) ?? throw new InvalidOperationException("The LightningChart host asset is missing from this package.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static async Task<(string Path, Dictionary<string, string> Headers)> ReadRequestAsync(NetworkStream stream, CancellationToken ct)
    {
        var bytes = new List<byte>();
        while (bytes.Count < 16 * 1024) { bytes.Add((await ReadExactAsync(stream, 1, ct).ConfigureAwait(false))[0]); if (bytes.Count >= 4 && bytes[^4] == 13 && bytes[^3] == 10 && bytes[^2] == 13 && bytes[^1] == 10) break; }
        var lines = Encoding.ASCII.GetString(bytes.ToArray()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in lines.Skip(1)) { var separator = line.IndexOf(':'); if (separator > 0) headers[line[..separator]] = line[(separator + 1)..].Trim(); }
        return (lines[0].Split(' ')[1].Split('?')[0], headers);
    }

    private static async Task WriteHttpAsync(NetworkStream stream, string contentType, byte[] body, string? additionalHeaders = null)
    {
        await stream.WriteAsync(Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: {contentType}\r\nContent-Length: {body.Length}\r\nCache-Control: no-store\r\n{additionalHeaders}Connection: close\r\n\r\n")).ConfigureAwait(false);
        await stream.WriteAsync(body).ConfigureAwait(false);
    }
    private static Task WriteNotFoundAsync(NetworkStream stream) => stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")).AsTask();
    private static Task WriteNoContentAsync(NetworkStream stream) => stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")).AsTask();
    private static async Task<byte[]> ReadExactAsync(NetworkStream stream, int length, CancellationToken ct)
    {
        var result = new byte[length]; var offset = 0;
        while (offset < length) { var read = await stream.ReadAsync(result.AsMemory(offset, length - offset), ct).ConfigureAwait(false); if (read == 0) throw new IOException("WebView connection closed."); offset += read; }
        return result;
    }
    public async ValueTask DisposeAsync() { _shutdown.Cancel(); _listener.Stop(); _outgoing.Writer.TryComplete(); DiscardPending(); await _acceptLoop.ConfigureAwait(false); _shutdown.Dispose(); }
}

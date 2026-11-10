using LightningChart.LA.Bij;

namespace LightningChart.LA.Api;

/// <summary>
/// Represents a chart created in the LCLA host.
/// All config/data methods are synchronous fire-and-forget — the transport guarantees message ordering.
/// Only CreateChartAsync (on LclaContext) is async because it needs the chartId from the response.
/// </summary>
public class LclaChart : IAsyncDisposable
{
    private readonly LclaContext _client;
    private readonly string _chartId;
    private bool _disposed;

    internal LclaChart(LclaContext client, string chartId)
    {
        _client = client;
        _chartId = chartId;
    }

    public string ChartId => _chartId;

    /// <summary>
    /// Update the chart and its datasets, axes, and series.
    /// Omitted objects and properties remain unchanged.
    /// </summary>
    public void Update(UpdateXYChartConfig config)
    {
        ThrowIfDisposed();

        var p = new Dictionary<string, object?>();
        
        if (config.Title != null)
            p["title"] = config.Title;
        // Reuse the creation serializers to convert configs to protocol fields, omitting unspecified properties.
        if (config.DataSets != null)
            p["dataSets"] = config.DataSets.Select(LclaContext.DataSetToObject).ToArray();

        if (config.Axes != null)
            p["axes"] = config.Axes.Select(LclaContext.AxisToObject).ToArray();

        if (config.Series != null)
            p["series"] = config.Series.Select(LclaContext.SeriesToObject).ToArray();

        SendConfig("update", p);
    }

    private void SendConfig(string action, object parameters)
    {
        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action,
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = parameters,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set data on a dataset, replacing any existing data.
    /// Named columns matching the dataset schema.
    /// </summary>
    public void SetData(SetDataOptions options)
    {
        ThrowIfDisposed();
        _client.SetData(options);
    }

    /// <summary>
    /// Append streaming data to a dataset. Fire-and-forget.
    /// Named columns matching the dataset schema.
    /// </summary>
    public void AppendData(AppendDataOptions options)
    {
        ThrowIfDisposed();
        _client.AppendData(options);
    }

    /// <summary>
    /// Clear all data from a dataset.
    /// </summary>
    public void ClearData(ClearDataOptions options)
    {
        ThrowIfDisposed();
        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "data",
                action = "clear",
                clientId = _client.ClientId,
                dataSetId = options.DataSetId,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "lifecycle",
                action = "dispose",
                clientId = _client.ClientId,
                chartId = _chartId,
            }),
        ]);
        _client.SendFireAndForget(message);
        await ValueTask.CompletedTask;
    }

    private void ThrowIfDisposed()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(LclaChart));
    }
}

// --- Data operation options ---

public class SetDataOptions
{
    public required string DataSetId { get; set; }
    public required IReadOnlyDictionary<string, double[]> Columns { get; set; }
    public int? MaxSampleCount { get; set; }
}

public class AppendDataOptions
{
    public required string DataSetId { get; set; }
    public required IReadOnlyDictionary<string, double[]> Columns { get; set; }
    public int? MaxSampleCount { get; set; }
}

public class ClearDataOptions
{
    public required string DataSetId { get; set; }
}

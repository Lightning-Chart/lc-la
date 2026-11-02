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

    /// <summary>
    /// Replace all matrix data of a heatmap series.
    /// Values is a flat Columns × Rows matrix in the data order the series was created with.
    /// </summary>
    public void SetMatrixData(SetMatrixDataOptions options)
    {
        ThrowIfDisposed();
        SendMatrixData("setMatrix", options.SeriesId, null, options.Values);
    }

    /// <summary>
    /// Replace a rectangular region of a heatmap series' matrix data.
    /// Values is a flat Columns × Rows region in the data order the series was created with.
    /// </summary>
    public void InvalidateMatrixData(InvalidateMatrixDataOptions options)
    {
        ThrowIfDisposed();
        if (options.Values.Length != options.Columns * options.Rows)
        {
            throw new ArgumentException($"Values must contain Columns * Rows ({options.Columns * options.Rows}) items.", nameof(options));
        }
        SendMatrixData("invalidateMatrix", options.SeriesId, new
        {
            iColumn = options.IColumn,
            iRow = options.IRow,
            columns = options.Columns,
            rows = options.Rows,
        }, options.Values);
    }

    /// <summary>
    /// Append samples (columns or rows, along the scroll dimension) to a scrolling heatmap series.
    /// Every sample must have the same length, matching the series resolution.
    /// </summary>
    public void AppendMatrixData(AppendMatrixDataOptions options)
    {
        ThrowIfDisposed();
        var samples = options.Samples;
        if (samples.Count == 0) return;

        var sampleLength = samples[0].Length;
        var values = new float[samples.Count * sampleLength];
        for (int i = 0; i < samples.Count; i++)
        {
            if (samples[i].Length != sampleLength)
            {
                throw new ArgumentException("All samples must have the same length.", nameof(options));
            }
            samples[i].CopyTo(values, i * sampleLength);
        }

        SendMatrixData("appendMatrix", options.SeriesId, new { sampleLength }, values);
    }

    private void SendMatrixData(string action, string seriesId, object? parameters, float[] values)
    {
        var meta = new Dictionary<string, object?>
        {
            ["id"] = _client.NextId(),
            ["category"] = "data",
            ["action"] = action,
            ["clientId"] = _client.ClientId,
            ["chartId"] = _chartId,
            ["seriesId"] = seriesId,
        };
        if (parameters != null) meta["params"] = parameters;

        _client.SendFireAndForget(BijEncoder.Encode([BijPart.Json("meta", meta), BijPart.Float32("values", values)]));
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

public class SetMatrixDataOptions
{
    public required string SeriesId { get; set; }
    public required float[] Values { get; set; }
}

public class InvalidateMatrixDataOptions
{
    public required string SeriesId { get; set; }
    public required int IColumn { get; set; }
    public required int IRow { get; set; }
    public required int Columns { get; set; }
    public required int Rows { get; set; }
    public required float[] Values { get; set; }
}

public class AppendMatrixDataOptions
{
    public required string SeriesId { get; set; }
    public required IReadOnlyList<float[]> Samples { get; set; }
}
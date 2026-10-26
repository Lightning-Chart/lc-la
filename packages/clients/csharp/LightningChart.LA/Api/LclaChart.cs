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
    /// Set the chart title.
    /// </summary>
    public void SetTitle(SetTitleOptions options)
    {
        ThrowIfDisposed();
        SendConfig("title", new { title = options.Title });
    }

    /// <summary>
    /// Set the visible title of a default or additional axis.
    /// </summary>
    public void SetAxisTitle(SetAxisTitleOptions  options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?> { ["title"] = options.Title, };
        if (options.Axis.HasValue) p["axis"] = AxisTargetToString(options.Axis.Value);
        if (options.AxisId != null) p["axisId"] = options.AxisId;

        SendConfig("axisTitle", p);
    }

    /// <summary>
    /// Set axis scroll strategies.
    /// </summary>
    public void SetScrollStrategy(SetScrollStrategyOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>();
        if (options.Axis.HasValue) p["axis"] = AxisTargetToString(options.Axis.Value);
        if (options.AxisId != null) p["axisId"] = options.AxisId;
        p["strategy"] = ScrollStrategyToString(options.Strategy);
        SendConfig("scrollStrategy", p);
    }

    /// <summary>
    /// Set a fixed axis interval (start/end range). Used for historical data viewing.
    /// </summary>
    public void SetAxisInterval(SetAxisIntervalOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>();
        if (options.Axis.HasValue) p["axis"] = AxisTargetToString(options.Axis.Value);
        if (options.Start.HasValue) p["start"] = options.Start.Value;
        if (options.End.HasValue) p["end"] = options.End.Value;
        if (options.AxisId != null) p["axisId"] = options.AxisId;
        if (options.Animate.HasValue) p["animate"] = options.Animate.Value;
        if (options.StopAxisAfter.HasValue) p["stopAxisAfter"] = options.StopAxisAfter.Value;
        SendConfig("axisInterval", p);
    }

    /// <summary>
    /// Set the default axis interval used during scrolling/real-time.
    /// Provide Start+End for a static default, or Length for a trailing window that follows latest data.
    /// </summary>
    public void SetDefaultAxisInterval(SetDefaultAxisIntervalOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>();
        if (options.Axis.HasValue) p["axis"] = AxisTargetToString(options.Axis.Value);
        if (options.Start.HasValue) p["start"] = options.Start.Value;
        if (options.End.HasValue) p["end"] = options.End.Value;
        if (options.Length.HasValue) p["length"] = options.Length.Value;
        if (options.AxisId != null) p["axisId"] = options.AxisId;
        SendConfig("defaultAxisInterval", p);
    }

    /// <summary>
    /// Set the tick strategy for an axis. Use DateTime for UNIX timestamp axes.
    /// </summary>
    public void SetTickStrategy(SetTickStrategyOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>
        {
            ["strategy"] = TickStrategyToString(options.Strategy),
        };
        if (options.Axis.HasValue) p["axis"] = AxisTargetToString(options.Axis.Value);
        if (options.AxisId != null) p["axisId"] = options.AxisId;
        SendConfig("tickStrategy", p);
    }

    /// <summary>
    /// Create or update datasets available to charts in this context.
    /// Dataset IDs must be unique within the context unless a dataset
    /// is intentionally shared by multiple charts.
    /// </summary>
    public void ConfigureDataSets(IReadOnlyList<DataSetConfig> dataSets)
    {
        ThrowIfDisposed();
        var dsObjects = dataSets.Select(ds =>
        {
            var obj = new Dictionary<string, object?>
            {
                ["id"] = ds.Id,
                ["columns"] = ds.Columns.Select(c =>
                {
                    var colObj = new Dictionary<string, object?> { ["id"] = c.Id };
                    if (c.DataPattern.HasValue)
                        colObj["dataPattern"] = DataPatternToString(c.DataPattern.Value);
                    return (object)colObj;
                }).ToArray(),
            };
            if (ds.MaxSampleCount.HasValue)
                obj["maxSampleCount"] = ds.MaxSampleCount.Value;
            return (object)obj;
        }).ToArray();
        SendConfig("datasets", new { datasets = dsObjects });
    }

    /// <summary>Configure additional axes. Default axes are configured when the chart is created.</summary>
    public void ConfigureAxes(IReadOnlyList<AxisConfig> axes)
    {
        ThrowIfDisposed();
        var axisObjects = axes.Select(axis =>
        {
            var obj = new Dictionary<string, object?> { ["id"] = axis.Id, ["axis"] = AxisTargetToString(axis.Axis) };
            if (axis.Title != null) obj["title"] = axis.Title;
            if (axis.Opposite.HasValue) obj["opposite"] = axis.Opposite.Value;
            if (axis.StackIndex.HasValue) obj["stackIndex"] = axis.StackIndex.Value;
            if (axis.ParallelIndex.HasValue) obj["parallelIndex"] = axis.ParallelIndex.Value;
            return (object)obj;
        }).ToArray();
        SendConfig("axes", new { axes = axisObjects });
    }

    /// <summary>Configure series on this chart.</summary>
    public void ConfigureSeries(IReadOnlyList<SeriesConfig> series)
    {
        ThrowIfDisposed();
        var seriesObjects = series.Select(config =>
        {
            var obj = new Dictionary<string, object?> { ["id"] = config.Id };
            if (config.Name != null) obj["name"] = config.Name;

            // The configuration class determines the serialized series type
            switch (config)
            {
                case LineSeriesConfig line:
                    obj["type"] = "line";
                    obj["dataSetId"] = line.DataSetId;
                    obj["x"] = line.X;
                    obj["y"] = line.Y;
                    if (line.Color != null) obj["color"] = line.Color;
                    if (line.XAxisId != null) obj["xAxisId"] = line.XAxisId;
                    if (line.YAxisId != null) obj["yAxisId"] = line.YAxisId;
                    break;

                case ScatterSeriesConfig scatter:
                    obj["type"] = "scatter";
                    obj["dataSetId"] = scatter.DataSetId;
                    obj["x"] = scatter.X;
                    obj["y"] = scatter.Y;
                    if (scatter.Color != null) obj["color"] = scatter.Color;
                    if (scatter.XAxisId != null) obj["xAxisId"] = scatter.XAxisId;
                    if (scatter.YAxisId != null) obj["yAxisId"] = scatter.YAxisId;
                    break;

                case LineScatterSeriesConfig lineScatter:
                    obj["type"] = "line+scatter";
                    obj["dataSetId"] = lineScatter.DataSetId;
                    obj["x"] = lineScatter.X;
                    obj["y"] = lineScatter.Y;
                    if (lineScatter.Color != null) obj["color"] = lineScatter.Color;
                    if (lineScatter.XAxisId != null) obj["xAxisId"] = lineScatter.XAxisId;
                    if (lineScatter.YAxisId != null) obj["yAxisId"] = lineScatter.YAxisId;
                    break;

                default:
                    throw new NotSupportedException($"Serialization is not implemented for {config.GetType().Name}.");
            }
            return (object)obj;
        }).ToArray();
        SendConfig("series", new { series = seriesObjects });
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

    private static string ScrollStrategyToString(ScrollStrategy s) => s switch
    {
        ScrollStrategy.Scrolling => "scrolling",
        ScrollStrategy.Fitting => "fitting",
        ScrollStrategy.Expansion => "expansion",
        _ => "fitting",
    };

    private static string? DataPatternToString(DataPattern pattern) => pattern switch
    {
        DataPattern.Progressive => "progressive",
        DataPattern.Regressive => "regressive",
        DataPattern.None => null,
        _ => null,
    };

    private static string AxisTargetToString(AxisTarget axis) => axis switch
    {
        AxisTarget.X => "x",
        AxisTarget.Y => "y",
        _ => "x",
    };

    private static string TickStrategyToString(TickStrategy s) => s switch
    {
        TickStrategy.Numeric => "numeric",
        TickStrategy.DateTime => "dateTime",
        TickStrategy.Time => "time",
        _ => "numeric",
    };

    private void ThrowIfDisposed()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(LclaChart));
    }
}

// --- Options classes ---
// All LclaChart methods use options objects so new properties can be added without breaking callers.
// Required properties use 'required' keyword. Optional properties are nullable with default null.

public class SetTitleOptions
{
    public required string Title { get; set; }
}

public class SetAxisTitleOptions
{
    public AxisTarget? Axis { get; set; }
    public string? AxisId { get; set; }
    public required string Title { get; set; }
}

public class SetScrollStrategyOptions
{
    public AxisTarget? Axis { get; set; }
    public string? AxisId { get; set; }
    public required ScrollStrategy Strategy { get; set; }
}

public class SetAxisIntervalOptions
{
    public AxisTarget? Axis { get; set; }
    public double? Start { get; set; }
    public double? End { get; set; }
    public string? AxisId { get; set; }
    public bool? Animate { get; set; }
    public bool? StopAxisAfter { get; set; }
}

public class SetDefaultAxisIntervalOptions
{
    public AxisTarget? Axis { get; set; }
    public double? Start { get; set; }
    public double? End { get; set; }
    /// <summary>
    /// Trailing window length. When set, the axis follows latest data: end=dataMax, start=dataMax-Length.
    /// </summary>
    public double? Length { get; set; }
    public string? AxisId { get; set; }
}

public class SetTickStrategyOptions
{
    public AxisTarget? Axis { get; set; }
    public required TickStrategy Strategy { get; set; }
    public string? AxisId { get; set; }
}

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

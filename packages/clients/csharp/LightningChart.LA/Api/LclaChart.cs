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
        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "title",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = new { title = options.Title },
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set axis scroll strategies.
    /// </summary>
    public void SetScrollStrategy(SetScrollStrategyOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>();
        if (options.AxisX.HasValue) p["axisX"] = ScrollStrategyToString(options.AxisX.Value);
        if (options.AxisY.HasValue) p["axisY"] = ScrollStrategyToString(options.AxisY.Value);

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "scrollStrategy",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = p,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set a fixed axis interval (start/end range). Used for historical data viewing.
    /// </summary>
    public void SetAxisInterval(SetAxisIntervalOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?> { ["axis"] = AxisTargetToString(options.Axis) };
        if (options.Start.HasValue) p["start"] = options.Start.Value;
        if (options.End.HasValue) p["end"] = options.End.Value;
        if (options.StackIndex.HasValue) p["stackIndex"] = options.StackIndex.Value;
        if (options.Animate.HasValue) p["animate"] = options.Animate.Value;

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "axisInterval",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = p,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set the default axis interval used during scrolling/real-time.
    /// Provide Start+End for a static default, or Length for a trailing window that follows latest data.
    /// </summary>
    public void SetDefaultAxisInterval(SetDefaultAxisIntervalOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?> { ["axis"] = AxisTargetToString(options.Axis) };
        if (options.Start.HasValue) p["start"] = options.Start.Value;
        if (options.End.HasValue) p["end"] = options.End.Value;
        if (options.Length.HasValue) p["length"] = options.Length.Value;
        if (options.StackIndex.HasValue) p["stackIndex"] = options.StackIndex.Value;

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "defaultAxisInterval",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = p,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set the tick strategy for an axis. Use DateTime for UNIX timestamp axes.
    /// </summary>
    public void SetTickStrategy(SetTickStrategyOptions options)
    {
        ThrowIfDisposed();
        var p = new Dictionary<string, object?>
        {
            ["axis"] = AxisTargetToString(options.Axis),
            ["strategy"] = TickStrategyToString(options.Strategy),
        };
        if (options.StackIndex.HasValue) p["stackIndex"] = options.StackIndex.Value;

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "tickStrategy",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = p,
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Configure datasets on this chart. Datasets that exist in the host
    /// but are not in the provided list will be removed.
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
            if (ds.XDataPattern.HasValue)
                obj["xDataPattern"] = DataPatternToString(ds.XDataPattern.Value);
            if (ds.MaxSampleCount.HasValue)
                obj["maxSampleCount"] = ds.MaxSampleCount.Value;
            return (object)obj;
        }).ToArray();

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "datasets",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = new { datasets = dsObjects },
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Configure channels on this chart. Channels that exist in the host
    /// but are not in the provided list will be removed.
    /// </summary>
    public void ConfigureChannels(IReadOnlyList<ChannelConfig> channels)
    {
        ThrowIfDisposed();
        var channelObjects = channels.Select(ch =>
        {
            var obj = new Dictionary<string, object?>
            {
                ["id"] = ch.Id,
                ["dataSetId"] = ch.DataSetId,
                ["column"] = ch.Column,
                ["name"] = ch.Name,
                ["color"] = ch.Color,
                ["type"] = ch.Type switch
                {
                    ChannelType.Line => "line",
                    ChannelType.Scatter => "scatter",
                    ChannelType.LineScatter => "line+scatter",
                    _ => "line",
                },
            };
            if (ch.StackIndex.HasValue)
                obj["stackIndex"] = ch.StackIndex.Value;
            return (object)obj;
        }).ToArray();

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id = _client.NextId(),
                category = "config",
                action = "channels",
                clientId = _client.ClientId,
                chartId = _chartId,
                @params = new { channels = channelObjects },
            }),
        ]);
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Set data on a dataset, replacing any existing data.
    /// Shared X values + named Y columns matching the dataset schema.
    /// </summary>
    public void SetData(SetDataOptions options)
    {
        ThrowIfDisposed();
        var meta = new Dictionary<string, object?>
        {
            ["id"] = _client.NextId(),
            ["category"] = "data",
            ["action"] = "set",
            ["clientId"] = _client.ClientId,
            ["dataSetId"] = options.DataSetId,
        };
        if (options.MaxSampleCount.HasValue)
        {
            meta["params"] = new { maxSampleCount = options.MaxSampleCount.Value };
        }

        var parts = new List<BijPart>
        {
            BijPart.Json("meta", meta),
            BijPart.Float64("x", options.X),
        };
        foreach (var (colName, colData) in options.Columns)
        {
            parts.Add(BijPart.Float64(colName, colData));
        }

        var message = BijEncoder.Encode(parts.ToArray());
        _client.SendFireAndForget(message);
    }

    /// <summary>
    /// Append streaming data to a dataset. Fire-and-forget.
    /// Shared X values + named Y columns.
    /// </summary>
    public void AppendData(AppendDataOptions options)
    {
        ThrowIfDisposed();
        var meta = new Dictionary<string, object?>
        {
            ["id"] = _client.NextId(),
            ["category"] = "data",
            ["action"] = "append",
            ["clientId"] = _client.ClientId,
            ["dataSetId"] = options.DataSetId,
        };
        if (options.MaxSampleCount.HasValue)
        {
            meta["params"] = new { maxSampleCount = options.MaxSampleCount.Value };
        }

        var parts = new List<BijPart>
        {
            BijPart.Json("meta", meta),
            BijPart.Float64("x", options.X),
        };
        foreach (var (colName, colData) in options.Columns)
        {
            parts.Add(BijPart.Float64(colName, colData));
        }

        var message = BijEncoder.Encode(parts.ToArray());
        _client.SendFireAndForget(message);
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

public class SetScrollStrategyOptions
{
    public ScrollStrategy? AxisX { get; set; }
    public ScrollStrategy? AxisY { get; set; }
}

public class SetAxisIntervalOptions
{
    public required AxisTarget Axis { get; set; }
    public double? Start { get; set; }
    public double? End { get; set; }
    public int? StackIndex { get; set; }
    public bool? Animate { get; set; }
}

public class SetDefaultAxisIntervalOptions
{
    public required AxisTarget Axis { get; set; }
    public double? Start { get; set; }
    public double? End { get; set; }
    /// <summary>
    /// Trailing window length. When set, the axis follows latest data: end=dataMax, start=dataMax-Length.
    /// </summary>
    public double? Length { get; set; }
    public int? StackIndex { get; set; }
}

public class SetTickStrategyOptions
{
    public required AxisTarget Axis { get; set; }
    public required TickStrategy Strategy { get; set; }
    public int? StackIndex { get; set; }
}

public class SetDataOptions
{
    public required string DataSetId { get; set; }
    public required double[] X { get; set; }
    public required IReadOnlyDictionary<string, double[]> Columns { get; set; }
    public int? MaxSampleCount { get; set; }
}

public class AppendDataOptions
{
    public required string DataSetId { get; set; }
    public required double[] X { get; set; }
    public required IReadOnlyDictionary<string, double[]> Columns { get; set; }
    public int? MaxSampleCount { get; set; }
}

public class ClearDataOptions
{
    public required string DataSetId { get; set; }
}

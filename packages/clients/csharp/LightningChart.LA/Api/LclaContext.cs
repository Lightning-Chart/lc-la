using LightningChart.LA.Bij;

namespace LightningChart.LA.Api;

/// <summary>
/// Transport abstraction for sending BIJ messages to the host.
/// Implemented by the Blazor Server adapter. Other host adapters may be added in the future.
/// </summary>
public interface ILclaTransport
{
    Task<byte[]> SendAsync(byte[] message, CancellationToken ct = default);
    void SendFireAndForget(byte[] message);
    /// <summary>
    /// Discard any pending fire-and-forget messages that haven't been sent yet.
    /// Call after stopping a streaming loop to prevent processing stale batches.
    /// </summary>
    void DiscardPending();
}

/// <summary>Implemented by transports that can report asynchronous host or rendering failures.</summary>
public interface ILclaErrorSource
{
    event EventHandler<LclaErrorEventArgs>? ErrorOccurred;
}

/// <summary>Details of an error reported by a chart host.</summary>
public enum LclaErrorCategory
{
    Initialization,
    License,
    Host,
    Communication,
    Data,
}

/// <summary>An actionable failure raised by a LightningChart client operation.</summary>
public sealed class LclaException : Exception
{
    public LclaException(LclaErrorCategory category, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        Category = category;
    }

    public LclaErrorCategory Category { get; }
}

/// <summary>Details of a failure reported by a chart host or client operation.</summary>
public sealed class LclaErrorEventArgs(LclaException exception, bool canContinue) : EventArgs
{
    public LclaException Exception { get; } = exception;
    public LclaErrorCategory Category => Exception.Category;
    public string TechnicalDetails => Exception.ToString();
    public bool CanContinue { get; } = canContinue;
}

/// <summary>
/// License configuration for LightningChart JS.
/// </summary>
public class LclaLicense
{
    /// <summary>
    /// LightningChart JS license key (required).
    /// </summary>
    public required string Key { get; set; }

    /// <summary>
    /// Application title for app deployment licenses. Defaults to the LightningChart JS trial title.
    /// </summary>
    public string AppTitle { get; set; } = "LightningChart JS Trial";

    /// <summary>
    /// Company name for app deployment licenses. Defaults to LightningChart Ltd.
    /// </summary>
    public string Company { get; set; } = "LightningChart Ltd.";

    /// <summary>
    /// LCJS theme. Built-in options: DarkGold (default), Light, LightNature, TurquoiseHexagon, CyberSpace.
    /// </summary>
    public LclaTheme? Theme { get; set; }
}

/// <summary>
/// Shared LCLA context. Creates and manages charts and datasets.
/// </summary>
public class LclaContext : IAsyncDisposable
{
    private readonly ILclaTransport _transport;
    private readonly LclaLicense _license;
    private int _nextId;
    private bool _initialized;
    private readonly List<LclaChart> _charts = new();
    private readonly string _clientId = Guid.NewGuid().ToString("N");
    private string? _lastReportedError;

    public LclaContext(ILclaTransport transport, LclaLicense license)
    {
        _transport = transport;
        _license = license;
        if (transport is ILclaErrorSource errorSource)
        {
            errorSource.ErrorOccurred += (_, args) => ReportError(args.Exception, args.CanContinue);
        }
    }

    /// <summary>Raised for initialization, host, communication, and asynchronous data failures.</summary>
    public event EventHandler<LclaErrorEventArgs>? ErrorOccurred;

    private void ReportError(LclaException exception, bool canContinue)
    {
        var signature = $"{exception.Category}:{exception.Message}";
        if (signature == _lastReportedError) return;
        _lastReportedError = signature;
        ErrorOccurred?.Invoke(this, new LclaErrorEventArgs(exception, canContinue));
    }

    private async Task<T> RunOperationAsync<T>(Func<Task<T>> operation, LclaErrorCategory category, bool canContinue)
    {
        try { return await operation().ConfigureAwait(false); }
        catch (OperationCanceledException) { throw; }
        catch (LclaException exception)
        {
            ReportError(exception, canContinue);
            throw;
        }
        catch (Exception exception)
        {
            var wrapped = new LclaException(category, exception.Message, exception);
            ReportError(wrapped, canContinue);
            throw wrapped;
        }
    }

    private Task EnsureInitializedAsync(CancellationToken ct = default) => RunOperationAsync(async () =>
    {
        if (_initialized) return true;

        var id = NextId();
        var initParams = new Dictionary<string, object?> { ["license"] = _license.Key };
        initParams["licenseInformation"] = new
        {
            appTitle = _license.AppTitle,
            company = _license.Company,
        };
        if (_license.Theme.HasValue)
        {
            initParams["theme"] = ThemeToString(_license.Theme.Value);
        }

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id,
                category = "lifecycle",
                action = "init",
                @params = initParams,
            }),
        ]);

        var responseBytes = await _transport.SendAsync(message, ct);
        var response = BijDecoder.Decode(responseBytes);
        var meta = (System.Text.Json.JsonElement)response["meta"];

        if (meta.GetProperty("type").GetString() == "error")
        {
            throw CreateHostException(meta.GetProperty("error").GetString(), LclaErrorCategory.Initialization);
        }

        _initialized = true;
        return true;
    }, LclaErrorCategory.Initialization, false);

    internal string NextId() => Interlocked.Increment(ref _nextId).ToString();
    internal void SendFireAndForget(byte[] message)
    {
        try { _transport.SendFireAndForget(message); }
        catch (LclaException exception)
        {
            ReportError(exception, false);
            throw;
        }
        catch (Exception exception)
        {
            var wrapped = new LclaException(LclaErrorCategory.Data, "LightningChart could not apply chart data or configuration.", exception);
            ReportError(wrapped, false);
            throw wrapped;
        }
    }
    internal string ClientId => _clientId;

    public void ConfigureDataSets(IReadOnlyList<DataSetConfig> dataSets)
    {
        var dataSetObjects = dataSets.Select(DataSetToObject).ToArray();
        SendFireAndForget(new
        {
            id = NextId(), category = "config", action = "datasets", clientId = _clientId,
            @params = new { datasets = dataSetObjects },
        });
    }

    public void SetData(SetDataOptions options) => SendData("set", options.DataSetId, options.X, options.Columns, options.MaxSampleCount);
    public void AppendData(AppendDataOptions options) => SendData("append", options.DataSetId, options.X, options.Columns, options.MaxSampleCount);

    public void ClearData(ClearDataOptions options) => SendFireAndForget(new
    {
        id = NextId(), category = "data", action = "clear", clientId = _clientId, dataSetId = options.DataSetId,
    });

    private void SendData(string action, string dataSetId, double[] x, IReadOnlyDictionary<string, double[]> columns, int? maxSampleCount)
    {
        var meta = new Dictionary<string, object?> { ["id"] = NextId(), ["category"] = "data", ["action"] = action, ["clientId"] = _clientId, ["dataSetId"] = dataSetId };
        if (maxSampleCount.HasValue) meta["params"] = new { maxSampleCount = maxSampleCount.Value };
        var parts = new List<BijPart> { BijPart.Json("meta", meta), BijPart.Float64("x", x) };
        foreach (var (name, values) in columns) parts.Add(BijPart.Float64(name, values));
        SendFireAndForget(BijEncoder.Encode(parts.ToArray()));
    }

    private void SendFireAndForget(object meta) => SendFireAndForget(BijEncoder.Encode([BijPart.Json("meta", meta)]));

    private static object DataSetToObject(DataSetConfig ds)
    {
        var value = new Dictionary<string, object?>
        {
            ["id"] = ds.Id,
            ["columns"] = ds.Columns.Select(c => new Dictionary<string, object?> { ["id"] = c.Id, ["dataPattern"] = DataPatternToString(c.DataPattern) }).ToArray(),
            ["xDataPattern"] = DataPatternToString(ds.XDataPattern),
            ["maxSampleCount"] = ds.MaxSampleCount,
        };
        return value.Where(pair => pair.Value != null).ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    private static string? DataPatternToString(DataPattern? pattern) => pattern switch
    {
        DataPattern.Progressive => "progressive", DataPattern.Regressive => "regressive", _ => null,
    };

    /// <summary>
    /// Create a new XY chart.
    /// </summary>
    public Task<LclaChart> CreateChartAsync(XYChartConfig? config = null, CancellationToken ct = default) => RunOperationAsync(async () =>
    {
        await EnsureInitializedAsync(ct);
        var id = NextId();
        var p = new Dictionary<string, object?> { ["type"] = "xy" };
        if (config?.ContainerId != null) p["containerId"] = config.ContainerId;
        if (config?.AnimationsEnabled.HasValue == true) p["animationsEnabled"] = config.AnimationsEnabled.Value;
        var createParams = (object)p;

        var message = BijEncoder.Encode([
            BijPart.Json("meta", new
            {
                id,
                category = "lifecycle",
                action = "create",
                clientId = _clientId,
                @params = createParams,
            }),
        ]);

        var responseBytes = await _transport.SendAsync(message, ct);
        var response = BijDecoder.Decode(responseBytes);
        var meta = (System.Text.Json.JsonElement)response["meta"];

        if (meta.GetProperty("type").GetString() == "error")
        {
            throw CreateHostException(meta.GetProperty("error").GetString(), LclaErrorCategory.Host);
        }

        var chartId = meta.GetProperty("result").GetProperty("chartId").GetString()!;
        var chart = new LclaChart(this, chartId);
        _charts.Add(chart);

        // Apply initial config if provided (fire-and-forget, transport guarantees ordering)
        if (config != null)
        {
            if (config.Title != null)
            {
                chart.SetTitle(new SetTitleOptions { Title = config.Title });
            }
            if (config.DataSets != null && config.DataSets.Count > 0)
            {
                chart.ConfigureDataSets(config.DataSets);
            }
            if (config.Channels != null && config.Channels.Count > 0)
            {
                chart.ConfigureChannels(config.Channels);
            }
        }

        return chart;
    }, LclaErrorCategory.Host, false);

    private static LclaException CreateHostException(string? detail, LclaErrorCategory fallback)
    {
        var message = string.IsNullOrWhiteSpace(detail) ? "LightningChart did not provide an error message." : detail;
        var category = message.Contains("license", StringComparison.OrdinalIgnoreCase)
            ? LclaErrorCategory.License
            : fallback;
        return new LclaException(category, message);
    }

    public ValueTask DisposeAsync()
    {
        foreach (var chart in _charts)
        {
            _ = chart.DisposeAsync();
        }
        _charts.Clear();
        return ValueTask.CompletedTask;
    }

    private static string ThemeToString(LclaTheme theme) => theme switch
    {
        LclaTheme.DarkGold => "darkGold",
        LclaTheme.Light => "light",
        LclaTheme.LightNature => "lightNature",
        LclaTheme.TurquoiseHexagon => "turquoiseHexagon",
        LclaTheme.CyberSpace => "cyberSpace",
        _ => "darkGold",
    };
}

/// <summary>
/// Configuration for creating an XY chart.
/// </summary>
public class XYChartConfig
{
    public string? Title { get; set; }
    public string? ContainerId { get; set; }
    public List<DataSetConfig>? DataSets { get; set; }
    public List<ChannelConfig>? Channels { get; set; }
    /// <summary>
    /// Enable or disable chart animations. Default: true (LCJS default).
    /// Set to false for real-time monitoring dashboards.
    /// </summary>
    public bool? AnimationsEnabled { get; set; }
}

/// <summary>
/// Configuration for a dataset within a chart.
/// A dataset has shared X values and one or more named Y columns.
/// </summary>
public class DataSetConfig
{
    public required string Id { get; set; }

    /// <summary>
    /// Data pattern for X values. Default: Progressive (timestamps, sequential indices).
    /// </summary>
    public DataPattern? XDataPattern { get; set; }

    /// <summary>
    /// Named Y columns in this dataset.
    /// </summary>
    public required List<DataSetColumnConfig> Columns { get; set; }

    /// <summary>
    /// Maximum number of samples to keep in memory.
    /// Oldest samples are discarded when exceeded. Default: 1,000,000.
    /// </summary>
    public int? MaxSampleCount { get; set; }
}

/// <summary>
/// Configuration for a single column within a dataset.
/// </summary>
public class DataSetColumnConfig
{
    public required string Id { get; set; }

    /// <summary>
    /// Data pattern for this column's values. Default: None.
    /// </summary>
    public DataPattern? DataPattern { get; set; }
}

/// <summary>
/// Configuration for a data channel within a chart.
/// A channel binds to a dataset column and renders it as a series.
/// </summary>
public class ChannelConfig
{
    public required string Id { get; set; }

    /// <summary>
    /// Which dataset this channel reads from.
    /// </summary>
    public required string DataSetId { get; set; }

    /// <summary>
    /// Which Y column in the dataset this channel visualizes.
    /// </summary>
    public required string Column { get; set; }

    public string? Name { get; set; }
    public string? Color { get; set; }
    public ChannelType Type { get; set; } = ChannelType.Line;

    /// <summary>
    /// Stack index for Y axis stacking. Channels with the same index share an axis.
    /// 0 or null = default Y axis. Higher values create additional stacked axes.
    /// </summary>
    public int? StackIndex { get; set; }
}

public enum ChannelType
{
    Line,
    Scatter,
    LineScatter,
}

/// <summary>
/// Describes the ordering pattern of data values.
/// Specifying correct patterns improves rendering performance.
/// </summary>
public enum DataPattern
{
    /// <summary>Newer samples always have larger values (e.g., timestamps).</summary>
    Progressive,
    /// <summary>Newer samples always have smaller values.</summary>
    Regressive,
    /// <summary>No assumed ordering.</summary>
    None,
}

/// <summary>
/// Axis scroll strategy. Controls how axes behave when new data arrives.
/// </summary>
public enum ScrollStrategy
{
    /// <summary>Axis scrolls to keep latest data visible with a fixed interval.</summary>
    Scrolling,
    /// <summary>Axis scales to fit all data.</summary>
    Fitting,
    /// <summary>Axis expands to fit new data but never shrinks.</summary>
    Expansion,
}

/// <summary>
/// Built-in LCJS themes.
/// </summary>
public enum LclaTheme
{
    DarkGold,
    Light,
    LightNature,
    TurquoiseHexagon,
    CyberSpace,
}

/// <summary>
/// Identifies which axis to target.
/// </summary>
public enum AxisTarget
{
    X,
    Y,
}

/// <summary>
/// Tick strategy for axis labels.
/// </summary>
public enum TickStrategy
{
    /// <summary>Standard numeric labels.</summary>
    Numeric,
    /// <summary>Date/time labels (axis values are UNIX timestamps in ms).</summary>
    DateTime,
    /// <summary>Time duration labels (axis values are milliseconds).</summary>
    Time,
}

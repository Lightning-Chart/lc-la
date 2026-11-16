using LightningChart.LA.Api;
using LightningChart.LA.WebView;

namespace MauiHeatmaps;

public sealed class MainPage : ContentPage, IAsyncDisposable
{
    private const string SeriesId = "scrolling-heatmap";
    private const int DataSampleSize = 1024;
    private const int HistoricalColumns = 3000;
    private const int ColumnsPerBatch = 10;
    private const int UpdatesPerSecond = 30;
    private const double ColumnStep = 1d / (ColumnsPerBatch * UpdatesPerSecond);
    private const double ColumnStepMs = ColumnStep * 1000;
    private const double ViewMs = 10 * 1000;

    private readonly WebView _scrollingView = new();
    private readonly CancellationTokenSource _lifetime = new();
    private WebViewTransport? _scrollingTransport;
    private LclaContext? _scrollingContext;
    private LclaChart? _scrollingChart;

    private double? _tFirstSample;
    private Task _streamTask = Task.CompletedTask;
    private bool _initializing;
    private bool _creatingScrollingChart;
    private bool _disposed;

    public MainPage()
    {
        Title = "Heatmaps";
        BackgroundColor = Color.FromArgb("#181818");
        Content = _scrollingView;

        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        _scrollingView.Navigated += OnNavigated;
    }

    private async void OnLoaded(object? sender, EventArgs args)
    {
        if (_initializing || _disposed) return;
        _initializing = true;

        try
        {
            _scrollingTransport = await WebViewTransport.StartAsync(_lifetime.Token);
            _lifetime.Token.ThrowIfCancellationRequested();
            _scrollingView.Source = _scrollingTransport.Uri.AbsoluteUri;
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception) { ShowError(exception); }
    }

    private async void OnNavigated(object? sender, WebNavigatedEventArgs args)
    {
        if (_disposed) return;

        var transport = _scrollingTransport;

        if (transport is null ||
            !Uri.TryCreate(args.Url, UriKind.Absolute, out var uri) ||
            Uri.Compare(
                uri,
                transport.Uri,
                UriComponents.SchemeAndServer | UriComponents.Path,
                UriFormat.Unescaped,
                StringComparison.OrdinalIgnoreCase) != 0)
        {
            return;
        }

        if (_creatingScrollingChart) return;
        _creatingScrollingChart = true;

        try
        {
            var licenseKey = Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
                ?? throw new InvalidOperationException("Set LCJS_LICENSE_KEY before starting the example.");

            var context = new LclaContext(transport, new LclaLicense { Key = licenseKey });
            context.ErrorOccurred += (_, eventArgs) => ShowError(eventArgs.Exception);
            _scrollingContext = context;

            _scrollingChart = await context.CreateChartAsync(new XYChartConfig
            {
                ContainerId = "lcla-root",
                Title = "Scrolling heatmap",
                Axes =
                [
                    new AxisConfig
                    {
                        Axis = AxisTarget.X,
                        Title = "Time",
                        TickStrategy = TickStrategy.DateTime,
                        ScrollStrategy = ScrollStrategy.Scrolling,
                        DefaultInterval = new AxisDefaultIntervalConfig { Length = ViewMs },
                    },
                    new AxisConfig
                    {
                        Axis = AxisTarget.Y,
                        Title = "Frequency",
                        Interval = new AxisIntervalConfig { Start = 0, End = DataSampleSize },
                    },
                ],
                Series =
                [
                    new ScrollingHeatmapSeriesConfig
                    {
                        Id = SeriesId,
                        Resolution = DataSampleSize,
                        ScrollDimension = ScrollDimension.Columns,
                        Step = new PointConfig { X = ColumnStepMs, Y = 1 },
                        DataCleaning = new DataCleaningConfig { MinDataPointCount = 1000 },
                        Palette = new LUTConfig
                        {
                            Steps =
                            [
                                new LUTStepConfig { Value = 0, Color = "#101020" },
                                new LUTStepConfig { Value = 15, Color = "#2030A0" },
                                new LUTStepConfig { Value = 30, Color = "#00BFFF" },
                                new LUTStepConfig { Value = 45, Color = "#00D080" },
                                new LUTStepConfig { Value = 60, Color = "#FFE040" },
                                new LUTStepConfig { Value = 75, Color = "#FF4020" },
                            ],
                            Interpolate = true,
                        },
                    },
                ],
            }, _lifetime.Token);

            var token = _lifetime.Token;
            var history = await Task.Run(() => CreateSamples(0, HistoricalColumns, token), token);

            token.ThrowIfCancellationRequested();

            var firstHistoricalTimestampMs =
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                - HistoricalColumns * ColumnStepMs;

            HandleIncomingData(firstHistoricalTimestampMs, history);

            _streamTask = Task.Run(() => StreamAsync(token));
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception) { ShowError(exception); }
    }

    private void HandleIncomingData(double timestamp, IReadOnlyList<float[]> samples)
    {
        if (_tFirstSample is null)
        {
            _tFirstSample = timestamp;

            _scrollingChart!.Update(new UpdateXYChartConfig
            {
                Series =
                [
                    new UpdateScrollingHeatmapSeriesConfig
                    {
                        Id = SeriesId,
                        Start = new PointConfig { X = timestamp, Y = 0 },
                    },
                ],
            });
        }

        var sampleIndex = (int)Math.Round(
            (timestamp - _tFirstSample.Value) / ColumnStepMs,
            MidpointRounding.AwayFromZero);

        _scrollingChart!.AppendMatrixData(new AppendMatrixDataOptions
        {
            SeriesId = SeriesId,
            ISample = sampleIndex,
            Samples = samples,
        });
    }

    private static float[][] CreateSamples(
        long firstColumn,
        int count,
        CancellationToken cancellationToken)
    {
        var samples = new float[count][];

        for (var column = 0; column < count; column++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var time = (firstColumn + column) * ColumnStep;
            var phase = 2 * Math.PI * time / 30;
            var center1 = 240 + 90 * Math.Sin(phase);
            var center2 = 690 + 110 * Math.Cos(2 * phase);
            var values = new float[DataSampleSize];

            for (var bin = 0; bin < DataSampleSize; bin++)
            {
                var distance1 = (bin - center1) / 35;
                var distance2 = (bin - center2) / 55;
                var background = Math.Sin(bin * 0.02 + phase);

                values[bin] = (float)(
                    5 +
                    60 * Math.Exp(-0.5 * distance1 * distance1) +
                    30 * Math.Exp(-0.5 * distance2 * distance2) +
                    5 * background * background);
            }

            samples[column] = values;
        }

        return samples;
    }


    private async Task StreamAsync(CancellationToken cancellationToken)
    {
        var startTimestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var clock = System.Diagnostics.Stopwatch.StartNew();
        long nextSample = 0;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1d / UpdatesPerSecond));

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                var availableSamples = (long)(clock.Elapsed.TotalMilliseconds / ColumnStepMs);
                var batchCount = (availableSamples - nextSample) / ColumnsPerBatch;

                if (batchCount == 0) continue;

                var sampleCount = checked((int)(batchCount * ColumnsPerBatch));
                var timestamp = startTimestamp + nextSample * ColumnStepMs;
                // In a real application, receive samples and their timestamps from the data source.
                var samples = CreateSamples(HistoricalColumns + nextSample, sampleCount, cancellationToken);

                cancellationToken.ThrowIfCancellationRequested();

                HandleIncomingData(timestamp, samples);

                nextSample  += sampleCount;
            }
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception) { ShowError(exception); }
    }

    private void ShowError(Exception exception)
    {
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            if (!_disposed)
                await DisplayAlertAsync("Chart error", exception.Message, "OK");
        });
    }

    private async void OnUnloaded(object? sender, EventArgs args)
    {
        try
        {
            await DisposeAsync();
        }
        catch (Exception exception)
        {
            System.Diagnostics.Debug.WriteLine(exception);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        Loaded -= OnLoaded;
        Unloaded -= OnUnloaded;
        _scrollingView.Navigated -= OnNavigated;

        _lifetime.Cancel();
        await _streamTask;

        if (_scrollingChart is not null)
            await _scrollingChart.DisposeAsync();

        if (_scrollingContext is not null)
            await _scrollingContext.DisposeAsync();

        if (_scrollingTransport is not null)
            await _scrollingTransport.DisposeAsync();

        _lifetime.Dispose();
    }
}
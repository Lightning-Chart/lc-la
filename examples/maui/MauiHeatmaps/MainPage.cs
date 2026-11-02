using LightningChart.LA.Api;
using LightningChart.LA.WebView;

namespace MauiHeatmaps;

public sealed class MainPage : ContentPage, IAsyncDisposable
{
    private const string SeriesId = "scrolling-heatmap";
    private const int Resolution = 1024;
    private const int HistoricalColumns = 3000;
    private const int ColumnsPerBatch = 10;
    private const int UpdatesPerSecond = 30;
    private const double ColumnStep =
        1d / (ColumnsPerBatch * UpdatesPerSecond);
    private const double WindowSeconds = 10;

    private readonly WebView _scrollingView = new();
    private readonly WebView _staticView = new();
    private readonly CancellationTokenSource _lifetime = new();

    private WebViewTransport? _scrollingTransport;
    private WebViewTransport? _staticTransport;
    private LclaContext? _scrollingContext;
    private LclaContext? _staticContext;
    private LclaChart? _scrollingChart;
    private LclaChart? _staticChart;

    private Task _streamTask = Task.CompletedTask;
    private bool _initializing;
    private bool _creatingScrollingChart;
    private bool _creatingStaticChart;
    private bool _disposed;

    public MainPage()
    {
        Title = "Heatmaps";
        BackgroundColor = Color.FromArgb("#181818");

        var layout = new Grid
        {
            RowSpacing = 8,
            RowDefinitions =
            [
                new() { Height = GridLength.Star },
                new() { Height = GridLength.Star },
            ],
        };

        layout.Add(_scrollingView, 0, 0);
        layout.Add(_staticView, 0, 1);
        Content = layout;

        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        _scrollingView.Navigated += OnNavigated;
        _staticView.Navigated += OnNavigated;
    }

    private async void OnLoaded(object? sender, EventArgs args)
    {
        if (_initializing || _disposed) return;
        _initializing = true;

        try
        {
            _scrollingTransport =
                await WebViewTransport.StartAsync(_lifetime.Token);
            _staticTransport =
                await WebViewTransport.StartAsync(_lifetime.Token);

            _lifetime.Token.ThrowIfCancellationRequested();

            _scrollingView.Source =
                _scrollingTransport.Uri.AbsoluteUri;
            _staticView.Source =
                _staticTransport.Uri.AbsoluteUri;
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception)
        {
            ShowError(exception);
        }
    }

    private async void OnNavigated(
        object? sender,
        WebNavigatedEventArgs args)
    {
        if (_disposed) return;

        var scrolling = ReferenceEquals(sender, _scrollingView);
        var transport = scrolling
            ? _scrollingTransport
            : _staticTransport;

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

        if (scrolling)
        {
            if (_creatingScrollingChart) return;
            _creatingScrollingChart = true;
        }
        else
        {
            if (_creatingStaticChart) return;
            _creatingStaticChart = true;
        }

        try
        {
            var licenseKey =
                Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
                ?? throw new InvalidOperationException(
                    "Set LCJS_LICENSE_KEY before starting the example.");

            var context = new LclaContext(
                transport,
                new LclaLicense { Key = licenseKey });

            context.ErrorOccurred += (_, eventArgs) =>
                ShowError(eventArgs.Exception);

            if (scrolling)
            {
                _scrollingContext = context;

                _scrollingChart =
                    await context.CreateChartAsync(new XYChartConfig
                    {
                        ContainerId = "lcla-root",
                        Title = "Scrolling heatmap",
                        AnimationsEnabled = false,
                        Axes =
                        [
                            new AxisConfig
                            {
                                Axis = AxisTarget.X,
                                Title = "Time (s)",
                                ScrollStrategy =
                                    ScrollStrategy.Scrolling,
                                DefaultInterval =
                                    new AxisDefaultIntervalConfig
                                    {
                                        Length = WindowSeconds,
                                    },
                            },
                            new AxisConfig
                            {
                                Axis = AxisTarget.Y,
                                Title = "Frequency bin",
                                Interval = new AxisIntervalConfig
                                {
                                    Start = 0,
                                    End = Resolution,
                                },
                            },
                        ],
                        Series =
                        [
                            new ScrollingHeatmapSeriesConfig
                            {
                                Id = SeriesId,
                                Name = "Simulated spectrum",
                                Resolution = Resolution,
                                ScrollDimension =
                                    HeatmapScrollDimension.Columns,
                                Start = new PointConfig { X = 0, Y = 0 },
                                Step = new PointConfig
                                {
                                    X = ColumnStep,
                                    Y = 1,
                                },
                                // TODO: Add LUT coloring and data cleaning.
                            },
                        ],
                    }, _lifetime.Token);

                // Generate ten seconds of simulated historical spectra.
                var token = _lifetime.Token;
                var history = await Task.Run(
                    () => CreateSamples(0, HistoricalColumns, token),
                    token);

                token.ThrowIfCancellationRequested();

                _scrollingChart.AppendMatrixData(
                    new AppendMatrixDataOptions
                    {
                        SeriesId = SeriesId,
                        Samples = history,
                    });

                _streamTask = Task.Run(() => StreamAsync(token));
            }
            else
            {
                _staticContext = context;

                _staticChart =
                    await context.CreateChartAsync(new XYChartConfig
                    {
                        ContainerId = "lcla-root",
                        Title = "Static heatmap",
                        AnimationsEnabled = false,
                        Axes =
                        [
                            new AxisConfig
                            {
                                Axis = AxisTarget.X,
                                Title = "Column",
                            },
                            new AxisConfig
                            {
                                Axis = AxisTarget.Y,
                                Title = "Row",
                            },
                        ],
                        // TODO: Add the static heatmap series and LUT coloring.
                    }, _lifetime.Token);
            }
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception)
        {
            ShowError(exception);
        }
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

            // Simulate two slowly shifting spectral peaks.
            var center1 = 240 + 90 * Math.Sin(phase);
            var center2 = 690 + 110 * Math.Cos(2 * phase);
            var values = new float[Resolution];

            for (var bin = 0; bin < Resolution; bin++)
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
        long nextColumn = HistoricalColumns;

        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(1d / UpdatesPerSecond));

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                // In a real application, obtain this batch from the data source.
                var samples = CreateSamples(
                    nextColumn,
                    ColumnsPerBatch,
                    cancellationToken);

                cancellationToken.ThrowIfCancellationRequested();

                _scrollingChart!.AppendMatrixData(
                    new AppendMatrixDataOptions
                    {
                        SeriesId = SeriesId,
                        Samples = samples,
                    });

                nextColumn += ColumnsPerBatch;
            }
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception)
        {
            ShowError(exception);
        }
    }

    private void ShowError(Exception exception)
    {
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            if (!_disposed)
                await DisplayAlertAsync(
                    "Chart error",
                    exception.Message,
                    "OK");
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
        _staticView.Navigated -= OnNavigated;

        _lifetime.Cancel();
        await _streamTask;

        if (_scrollingChart is not null)
            await _scrollingChart.DisposeAsync();
        if (_staticChart is not null)
            await _staticChart.DisposeAsync();

        if (_scrollingContext is not null)
            await _scrollingContext.DisposeAsync();
        if (_staticContext is not null)
            await _staticContext.DisposeAsync();

        if (_scrollingTransport is not null)
            await _scrollingTransport.DisposeAsync();
        if (_staticTransport is not null)
            await _staticTransport.DisposeAsync();

        _lifetime.Dispose();
    }
}
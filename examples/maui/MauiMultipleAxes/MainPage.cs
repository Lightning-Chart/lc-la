using System.Globalization;
using LightningChart.LA.Api;
using LightningChart.LA.WebView;

namespace MauiMultipleAxes;

public sealed class MainPage : ContentPage, IAsyncDisposable
{
    private const string DataSetId = "signals";
    private const int BatchSize = 10_240;
    private const int UpdatesPerSecond = 30;
    private const double SamplesPerSecond = BatchSize * UpdatesPerSecond;
    private const double WindowSeconds = 3;

    private readonly WebView _webView = new();
    private readonly Button _streamButton = new() { Text = "Start", IsEnabled = false };
    private readonly Label _status = new() { Text = "Connecting…", TextColor = Colors.White, VerticalTextAlignment = TextAlignment.Center };
    private readonly CancellationTokenSource _lifetime = new();

    private WebViewTransport? _transport;
    private LclaContext? _context;
    private LclaChart? _chart;
    private CancellationTokenSource? _streamCancellation;
    private Task _streamTask = Task.CompletedTask;

    private long _nextSample;
    private bool _initializing;
    private bool _creating;
    private bool _changingState;
    private bool _disposed;

    public MainPage()
    {
        Title = "Vertical multiple-axis streaming";
        BackgroundColor = Color.FromArgb("#181818");

        var controls = new HorizontalStackLayout { Padding = 12, Spacing = 16, Children = { _streamButton, _status } };
        var layout = new Grid { RowDefinitions = [ new() { Height = GridLength.Auto }, new() { Height = GridLength.Star } ] };
        layout.Add(controls, 0, 0);
        layout.Add(_webView, 0, 1);
        Content = layout;

        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        _webView.Navigated += OnNavigated;
        _streamButton.Clicked += OnStreamClicked;
    }

    private async void OnLoaded(object? sender, EventArgs args)
    {
        if (_initializing || _disposed) return;
        _initializing = true;

        try
        {
            _transport = await WebViewTransport.StartAsync(_lifetime.Token);
            _webView.Source = _transport.Uri.AbsoluteUri;
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception) { ShowError(exception); }
    }

    private async void OnNavigated(object? sender, WebNavigatedEventArgs args)
    {
        if (_creating || _disposed || _transport is null ||
            !Uri.TryCreate(args.Url, UriKind.Absolute, out var uri) ||
            Uri.Compare(
                uri,
                _transport.Uri,
                UriComponents.SchemeAndServer | UriComponents.Path,
                UriFormat.Unescaped,
                StringComparison.OrdinalIgnoreCase) != 0)
        {
            return;
        }

        _creating = true;

        try
        {
            var licenseKey = Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
                ?? throw new InvalidOperationException("Set LCJS_LICENSE_KEY before starting the example.");

            _context = new LclaContext(_transport, new LclaLicense { Key = licenseKey });
            _context.ErrorOccurred += (_, eventArgs) =>
                MainThread.BeginInvokeOnMainThread(() => ShowError(eventArgs.Exception));

            _chart = await _context.CreateChartAsync(new XYChartConfig
            {
                ContainerId = "lcla-root",
                Title = "Vertical multiple-axis streaming",
                DefaultAxisX = new DefaultAxisConfig { Title = "Vibration (mm/s)" },
                DefaultAxisY = new DefaultAxisConfig { Title = "Time (s)" },
                DataSets =
                [
                    new DataSetConfig
                    {
                        Id = DataSetId,
                        MaxSampleCount = 1_048_576,
                        Columns =
                        [
                            new DataSetColumnConfig { Id = "time", DataPattern = DataPattern.Progressive },
                            new DataSetColumnConfig { Id = "vibration" },
                            new DataSetColumnConfig { Id = "temperature" },
                            new DataSetColumnConfig { Id = "pressure" },
                        ],
                    },
                ],
                Axes =
                [
                    // Top X axis, parallel to the default bottom X
                    new AxisConfig
                    {
                        Id = "temperature",
                        Axis = AxisTarget.X,
                        Title = "Temperature (°C)",
                        Opposite = true,
                        StackIndex = 0,
                        ParallelIndex = 0,
                    },
                    // Second bottom X axis, parallel to vibration
                    new AxisConfig
                    {
                        Id = "pressure",
                        Axis = AxisTarget.X,
                        Title = "Pressure (bar)",
                        StackIndex = 0,
                        ParallelIndex = 1,
                    },
                    // Additional time axis on the right
                    new AxisConfig
                    {
                        Id = "time-right",
                        Axis = AxisTarget.Y,
                        Title = "Time (s)",
                        Opposite = true,
                        StackIndex = 0,
                        ParallelIndex = 0,
                    },
                ],
                Series =
                [
                    // Default X displays vibration, default Y displays time
                    new LineSeriesConfig
                    {
                        Id = "vibration",
                        Name = "Vibration (mm/s)",
                        DataSetId = DataSetId,
                        X = "vibration",
                        Y = "time",
                        Color = "#FFD400",
                    },
                    // Additional X axis, the same default Y time axis
                    new LineSeriesConfig
                    {
                        Id = "temperature",
                        Name = "Temperature (°C)",
                        DataSetId = DataSetId,
                        X = "temperature",
                        Y = "time",
                        XAxisId = "temperature",
                        Color = "#FF7866",
                    },
                    new LineSeriesConfig
                    {
                        Id = "pressure",
                        Name = "Pressure (bar)",
                        DataSetId = DataSetId,
                        X = "pressure",
                        Y = "time",
                        XAxisId = "pressure",
                        YAxisId = "time-right",
                        Color = "#6ACBFF",
                    },
                ],
            }, _lifetime.Token);
            _chart.SetAxisInterval(new SetAxisIntervalOptions { Axis = AxisTarget.X, Start = 0, End = 4, StopAxisAfter = true });
            _chart.SetAxisInterval(new SetAxisIntervalOptions { AxisId = "temperature", Start = 40, End = 80, StopAxisAfter = true });
            _chart.SetAxisInterval(new SetAxisIntervalOptions { AxisId = "pressure", Start = 3, End = 7, StopAxisAfter = true });
            // Shared time axis: increasing values progress downward
            _chart.SetScrollStrategy(new SetScrollStrategyOptions { Axis = AxisTarget.Y, Strategy = ScrollStrategy.Scrolling });
            _chart.SetAxisInterval(new SetAxisIntervalOptions { Axis = AxisTarget.Y, Start = WindowSeconds, End = 0, Animate = false, StopAxisAfter = false });

            if (!_disposed)
            {
                _chart.SetScrollStrategy(new SetScrollStrategyOptions { AxisId = "time-right", Strategy = ScrollStrategy.Scrolling });
                _chart.SetAxisInterval(new SetAxisIntervalOptions { AxisId = "time-right", Start = WindowSeconds, End = 0, Animate = false, StopAxisAfter = false });
                _status.Text = "Ready";
                _streamButton.IsEnabled = true;
            }
        }
        catch (OperationCanceledException) when (_disposed) { }
        catch (Exception exception) { ShowError(exception); }
    }

    private async void OnStreamClicked(object? sender, EventArgs args)
    {
        if (_changingState || _disposed || _chart is null) return;
        _changingState = true;
        _streamButton.IsEnabled = false;

        try
        {
            if (!_streamTask.IsCompleted)
            {
                await StopStreamingAsync();
                _streamButton.Text = "Resume";
                _status.Text = "Paused";
            }
            else
            {
                _streamCancellation?.Dispose();
                _streamCancellation = CancellationTokenSource.CreateLinkedTokenSource(_lifetime.Token);
                var token = _streamCancellation.Token;
                _streamTask = Task.Run(() => StreamAsync(token));
                _streamButton.Text = "Pause";
                _status.Text = $"{BatchSize:N0} samples/batch · {UpdatesPerSecond} updates/s target";
            }
        }
        catch (Exception exception) { ShowError(exception); }
        finally
        {
            _changingState = false;
            if (!_disposed) _streamButton.IsEnabled = true;
        }
    }

    private async Task StreamAsync(CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1d / UpdatesPerSecond));

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                var batch = CreateBatch(_nextSample);
                cancellationToken.ThrowIfCancellationRequested();

                _chart!.AppendData(new AppendDataOptions
                {
                    DataSetId = DataSetId,
                    Columns = batch,
                });

                _nextSample += BatchSize;
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                ShowError(exception);
                if (!_disposed) _streamButton.Text = "Resume";
            });
        }
    }

    private static Dictionary<string, double[]> CreateBatch(long firstSample)
    {
        var time = new double[BatchSize];
        var vibration = new double[BatchSize];
        var temperature = new double[BatchSize];
        var pressure = new double[BatchSize];

        for (var i = 0; i < BatchSize; i++)
        {
            var t = (firstSample + i) / SamplesPerSecond;
            time[i] = t;
            vibration[i] = 2 + 0.7 * Math.Sin(2 * Math.PI * 1.2 * t);
            temperature[i] = 60 + 12 * Math.Sin(2 * Math.PI * 0.55 * t + 0.7);
            pressure[i] = 5 + 1.3 * Math.Sin(2 * Math.PI * 0.8 * t + 1.8);
        }

        return new Dictionary<string, double[]>
        {
            ["time"] = time,
            ["vibration"] = vibration,
            ["temperature"] = temperature,
            ["pressure"] = pressure,
        };
    }

    private async Task StopStreamingAsync()
    {
        _streamCancellation?.Cancel();
        await _streamTask;
        _streamCancellation?.Dispose();
        _streamCancellation = null;
    }

    private void ShowError(Exception exception)
    {
        if (!_disposed) _status.Text = $"Error: {exception.Message}";
    }

    private async void OnUnloaded(object? sender, EventArgs args)
    {
        try { await DisposeAsync(); }
        catch (Exception exception) { System.Diagnostics.Debug.WriteLine(exception); }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        Loaded -= OnLoaded;
        Unloaded -= OnUnloaded;
        _webView.Navigated -= OnNavigated;
        _streamButton.Clicked -= OnStreamClicked;

        _lifetime.Cancel();
        await StopStreamingAsync();

        if (_context is not null) await _context.DisposeAsync();
        if (_transport is not null) await _transport.DisposeAsync();

        _lifetime.Dispose();
    }
}
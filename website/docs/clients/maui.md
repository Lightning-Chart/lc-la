---
title: MAUI
---

Use LightningChart with .NET MAUI applications.

Tested with .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Example

The [MAUI example on GitHub](https://github.com/Lightning-Chart/lc-la-example-maui) displays patient vital signs in stacked chart sections. View the historical recording or start, pause, and resume replay. Its README walks through running it locally.

## License key

LightningChart for MAUI requires a license key. [Get a free trial key](https://lightningchart.com/js-charts/) or use your commercial key. Load the key through the configuration method used by your application.

Create one license and use it when initializing the shared context after the WebView has loaded.

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

## Creating a chart

Use a WebView to display the chart. Start its transport when the page loads, then create the context and chart after navigation succeeds.

The following example reads the license key from the `LCJS_LICENSE_KEY` environment variable supplied to the application. It creates a line series using the `"time"` and `"value"` columns of the `"signals"` dataset:

```csharp
using LightningChart.LA.Api;
using LightningChart.LA.WebView;
using Microsoft.Maui.Controls;

public sealed class SignalPage : ContentPage
{
    private readonly WebView _webView = new();
    private WebViewTransport? _transport;
    private LclaContext? _context;
    private LclaChart? _chart;

    public SignalPage()
    {
        Content = _webView;

        _webView.Navigated += async (_, args) =>
        {
            if (args.Result != WebNavigationResult.Success ||
                _transport is null ||
                _context is not null)
            {
                return;
            }

            var licenseKey = Environment.GetEnvironmentVariable("LCJS_LICENSE_KEY")
                ?? throw new InvalidOperationException("LCJS_LICENSE_KEY is not configured.");

            var license = new LclaLicense
            {
                Key = licenseKey,
                AppTitle = "My MAUI App",
                Company = "My Company",
            };

            _context = new LclaContext(_transport, license);

            _chart = await _context.CreateChartAsync(new XYChartConfig
            {
                DataSets =
                [
                    new DataSetConfig
                    {
                        Id = "signals",
                        MaxSampleCount = 1_000_000,
                        Columns =
                        [
                            new DataSetColumnConfig
                            {
                                Id = "time",
                                DataPattern = DataPattern.Progressive,
                            },
                            new DataSetColumnConfig { Id = "value" },
                        ],
                    },
                ],
                Series =
                [
                    new LineSeriesConfig
                    {
                        Id = "signal",
                        DataSetId = "signals",
                        X = "time",
                        Y = "value",
                        Name = "Signal",
                    },
                ],
            });
        };

        Loaded += async (_, _) =>
        {
            if (_transport is not null) return;

            _transport = await WebViewTransport.StartAsync();
            _webView.Source = _transport.Uri.AbsoluteUri;
        };
    }
}
```

Create the context once and use it to create additional charts. Size and position charts through your application's native layout.

In the following examples, `signalService` represents your application's data source and supplies timestamps in milliseconds and signal values as `double[]` arrays.

## Historical data

After chart creation, load data through your MAUI app's service, file, or API workflow, then supply the samples through `SetData`. Use the following inside an asynchronous page method:

```csharp
var samples = await signalService.LoadAsync();

_chart.SetData(new SetDataOptions
{
    DataSetId = "signals",
    Columns = new Dictionary<string, double[]>
    {
        ["time"] = samples.Timestamps,
        ["value"] = samples.Values,
    },
});
```

Calling `SetData` again replaces the dataset's samples while retaining its series bindings.

## Real-time data

Append batches received from a device, service, or WebSocket. After chart creation, use the following inside an asynchronous page method to configure the X axis to follow the latest samples with a ten-second window:

```csharp
_chart.Update(new UpdateXYChartConfig
{
    Axes =
    [
        new UpdateAxisConfig
        {
            Axis = AxisTarget.X,
            ScrollStrategy = ScrollStrategy.Scrolling,
            DefaultInterval = new AxisDefaultIntervalConfig { Length = 10_000 },
        },
    ],
});

await foreach (var batch in signalService.StreamAsync(cancellationToken))
{
    _chart.AppendData(new AppendDataOptions
    {
        DataSetId = "signals",
        Columns = new Dictionary<string, double[]>
        {
            ["time"] = batch.Timestamps,
            ["value"] = batch.Values,
        },
    });
}
```

Cancel streaming when the page is removed. Dispose the chart, context, and transport by calling their `DisposeAsync()` methods.

## Troubleshooting

If the chart cannot start, the chart area shows the error and a **Copy error** button. Include the copied error when requesting support.

## More features

LightningChart for MAUI supports multiple axes, configurable series, datasets, historical data, and streaming data features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for MAUI is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

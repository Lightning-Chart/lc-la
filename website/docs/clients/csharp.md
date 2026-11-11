---
title: Blazor
---

Use LightningChart with Blazor Server, Blazor WebAssembly, and Blazor Hybrid applications.

Tested with .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Examples

The [Blazor Server example on GitHub](https://github.com/Lightning-Chart/lc-la-example-blazor-server) displays an ECG recording across twelve charts sharing one dataset, with continuous replay. The [Blazor WebAssembly example](https://github.com/Lightning-Chart/lc-la-example-blazor-wasm) replays recorded vehicle telemetry across six charts sharing one dataset. Each example's README walks through running it locally.

## License key

LightningChart for Blazor requires a license key. Get a free trial key or use your commercial key, then configure it in your application before creating a chart:

```csharp
var license = new LclaLicense
{
    Key = builder.Configuration["LCJS_LICENSE_KEY"]!,
    AppTitle = "My Blazor App",
    Company = "My Company",
};
```

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

## Creating a chart

In a Blazor component, create the context and the chart after the container has rendered.

The following reads the license key from the application's `LCJS_LICENSE_KEY` configuration setting. It creates a line series using the `"time"` and `"value"` columns of the `"signals"` dataset:

```csharp
@using LightningChart.LA.Api
@using LightningChart.LA.Blazor
@using Microsoft.JSInterop
@inject IJSRuntime JSRuntime
@inject IConfiguration Configuration

<div id="signal-chart" style="height: 480px"></div>

@code {
    private BlazorTransport? _transport;
    private LclaContext? _context;
    private LclaChart? _chart;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (!firstRender) return;

        var license = new LclaLicense
        {
            Key = Configuration["LCJS_LICENSE_KEY"]!,
            AppTitle = "My Blazor App",
            Company = "My Company",
        };

        _transport = new BlazorTransport(JSRuntime);
        _context = new LclaContext(_transport, license);

        _chart = await _context.CreateChartAsync(new XYChartConfig
        {
            ContainerId = "signal-chart",
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
    }
}
```


## Historical data

After chart creation, load data from the service, file, or API used by your application, then supply the samples through `SetData`. Use the following inside an asynchronous component method.

Here, `signalService.LoadAsync()` represents your application's data source and supplies timestamps in milliseconds and signal values as `double[]` arrays.

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

For incoming data from a device, background service, or SignalR hub, append each received batch to the dataset.

After chart creation, use the following inside an asynchronous component method. It configures the default X axis to follow incoming timestamps with a ten-second window.

Here, `signalService.StreamAsync(cancellationToken)` represents your application's incoming batches. Each batch supplies timestamps in milliseconds and signal values as `double[]` arrays.

```csharp
_chart.Update(new UpdateXYChartConfig
{
    Axes =
    [
        new UpdateAxisConfig
        {
            Axis = AxisTarget.X,
            ScrollStrategy = ScrollStrategy.Scrolling,
            DefaultInterval = new AxisDefaultIntervalConfig
            {
                Length = 10_000,
            },
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

When streaming stops, call `DiscardPending()` on the `BlazorTransport` to drop batches that have not yet been sent. Dispose the chart and context by calling their `DisposeAsync()` methods when the component is removed.

## More features

LightningChart for Blazor supports multiple axes, configurable series, datasets, historical data, and streaming data features. For complete feature coverage, see [Features](../features/) for configuration examples and supported settings.

## Feedback and contributions

LightningChart for Blazor is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

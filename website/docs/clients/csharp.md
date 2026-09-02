---
title: Blazor
---

Use LightningChart with Blazor Server, Blazor WebAssembly, and Blazor Hybrid applications.

Tested with .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Example

The [Blazor example on GitHub](https://github.com/Lightning-Chart/lc-la-example-blazor-server) loads historical data and streams live batches. Its README walks through running it locally.

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

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses. In a Blazor component, create the context after the chart container has rendered:

```csharp
@using LightningChart.LA.Api
@using LightningChart.LA.Blazor
@inject IJSRuntime JS
@inject IConfiguration Configuration

<div id="signal-chart" style="height: 480px"></div>

@code {
    private LclaContext? _context;

    protected override void OnAfterRender(bool firstRender)
    {
        if (firstRender)
        {
            var license = new LclaLicense
            {
                Key = Configuration["LCJS_LICENSE_KEY"]!,
            };
            _context = new LclaContext(new BlazorTransport(JS), license);
        }
    }
}
```

## Historical data

Load data from the service, file, or API used by your application, then replace the dataset with `SetData`. Create the chart once its container exists.

```csharp
var chart = await _context!.CreateChartAsync(new XYChartConfig
{
    ContainerId = "signal-chart",
    Title = "Historical signal",
    DataSets =
    [
        new DataSetConfig
        {
            Id = "signals",
            MaxSampleCount = 2_000_000,
            Columns = [new DataSetColumnConfig { Id = "value" }],
        },
    ],
    Channels =
    [
        new ChannelConfig
        {
            Id = "value",
            DataSetId = "signals",
            Column = "value",
            Name = "Signal",
        },
    ],
});

var samples = await signalService.LoadAsync();
chart.SetData(new SetDataOptions
{
    DataSetId = "signals",
    X = samples.Timestamps,
    Columns = new Dictionary<string, double[]>
    {
        ["value"] = samples.Values,
    },
});
```

## Real-time data

For a stream from a device, background service, or SignalR hub, append each received batch. Use a scrolling X axis and a trailing interval to follow the newest samples.

```csharp
chart.SetScrollStrategy(new SetScrollStrategyOptions
{
    AxisX = ScrollStrategy.Scrolling,
});
chart.SetDefaultAxisInterval(new SetDefaultAxisIntervalOptions
{
    Axis = AxisTarget.X,
    Length = 10_000,
});

await foreach (var batch in signalService.StreamAsync(cancellationToken))
{
    chart.AppendData(new AppendDataOptions
    {
        DataSetId = "signals",
        X = batch.Timestamps,
        Columns = new Dictionary<string, double[]>
        {
            ["value"] = batch.Values,
        },
    });
}
```

When streaming stops, call `DiscardPending()` on the `BlazorTransport` to drop batches that have not yet been sent. Dispose the chart and context with `await using` when the component is removed.

## More features

LightningChart for Blazor supports the shared chart, channel, dataset, historical-data, and streaming-data features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for Blazor is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

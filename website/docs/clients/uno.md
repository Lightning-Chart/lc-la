---
title: Uno
---

Tested with Uno Platform project targeting .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Examples

Explore the [Uno Platform examples](https://github.com/Lightning-Chart/lc-la/tree/master/examples/uno). Each example has its own README with instructions for running it locally.

## License key

LightningChart for Uno requires a license key. [Get a free trial key](https://lightningchart.com/js-charts/) or use your commercial key. Load the key through the configuration method used by your application. In the example below, `licenseKey` represents that configured value.


Create one license and use it when initializing the shared context after the `WebView2` has loaded:

```csharp
var license = new LclaLicense
{
    Key = licenseKey,
    AppTitle = "My Uno App",
    Company = "My Company",
};

var transport = await WebViewTransport.StartAsync();
webView.Source = transport.Uri;

var context = new LclaContext(transport, license);
```

Create the context once and use it to create additional charts.

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

## Historical data

Load data through the service, file, or API workflow in your Uno application, then replace the dataset:

```csharp
var chart = await context.CreateChartAsync(new XYChartConfig
{
    DataSets =
    [
        new DataSetConfig
        {
            Id = "signals",
            MaxSampleCount = 2_000_000,
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

var samples = await signalService.LoadAsync();

chart.SetData(new SetDataOptions
{
    DataSetId = "signals",
    Columns = new Dictionary<string, double[]>
    {
        ["time"] = samples.Timestamps,
        ["value"] = samples.Values,
    },
});
```

## Real-time data

Append batches received from your application's data source:

```csharp
chart.SetScrollStrategy(new SetScrollStrategyOptions
{
    Axis = AxisTarget.X,
    Strategy = ScrollStrategy.Scrolling,
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
        Columns = new Dictionary<string, double[]>
        {
            ["time"] = batch.Timestamps,
            ["value"] = batch.Values,
        },
    });
}
```

Dispose the chart, context, and transport when the page is removed.

## More features

LightningChart for Uno Platform supports multiple axes, configurable series, datasets, historical data, and streamingdata features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for Uno Platform is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

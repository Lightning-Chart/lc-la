---
title: Uno
---

Use LightningChart with Uno Platform applications.

Tested with Uno Platform targeting .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Example

The [Uno Platform example on GitHub](https://github.com/Lightning-Chart/lc-la-example-uno) replays a recorded drone flight, displaying telemetry, the flight path, and current measurements. Its README walks through running it locally.

## License key

LightningChart for Uno requires a license key. [Get a free trial key](https://lightningchart.com/js-charts/) or use your commercial key, then load the chart into a `WebView2`:

```csharp
var transport = await WebViewTransport.StartAsync();
webView.Source = transport.Uri;

var context = new LclaContext(transport, new LclaLicense
{
    Key = licenseKey,
    AppTitle = "My Uno App",
    Company = "My Company",
});
```

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

## Historical data

Load data through the service, file, or API workflow in your Uno application, then replace the dataset:

```csharp
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
chart.Update(new UpdateXYChartConfig
{
    Axes =
    [
        new UpdateAxisConfig { Axis = AxisTarget.X, ScrollStrategy = ScrollStrategy.Scrolling },
    ],
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

---
title: MAUI
---

Tested with .NET 10 MAUI project.

## Install

```bash
dotnet add package LCLA
```

## Example

The [MAUI example on GitHub](https://github.com/Lightning-Chart/lc-la/tree/master/examples/maui) loads 1,000,000 historical samples and lets you start or stop 10,000-sample real-time batches. Its README walks through running it locally.

## License key

Get a free trial key or use your commercial key, then create the chart when the WebView has loaded:

```csharp
var transport = await WebViewTransport.StartAsync();
webView.Source = transport.Uri.AbsoluteUri;

var context = new LclaContext(transport, new LclaLicense
{
    Key = licenseKey,
    AppTitle = "My MAUI App",
    Company = "My Company",
});
```

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

## Historical data

Load data through your MAUI app's service, file, or API workflow, then replace the dataset:

```csharp
chart.SetData(new SetDataOptions
{
    DataSetId = "signals",
    X = samples.Timestamps,
    Columns = new Dictionary<string, double[]> { ["value"] = samples.Values },
});
```

## Real-time data

Append batches received from a device, service, or WebSocket. Configure the X axis to follow the latest samples:

```csharp
chart.SetScrollStrategy(new SetScrollStrategyOptions { AxisX = ScrollStrategy.Scrolling });
chart.SetDefaultAxisInterval(new SetDefaultAxisIntervalOptions { Axis = AxisTarget.X, Length = 10_000 });

await foreach (var batch in signalService.StreamAsync(cancellationToken))
{
    chart.AppendData(new AppendDataOptions
    {
        DataSetId = "signals",
        X = batch.Timestamps,
        Columns = new Dictionary<string, double[]> { ["value"] = batch.Values },
    });
}
```

Dispose the chart, context, and transport when the page is removed.

## Troubleshooting

If the chart cannot start, the chart area shows the error and a **Copy error** button. Include the copied error when requesting support.

## More features

LightningChart for MAUI supports the shared chart, channel, dataset, historical-data, and streaming-data features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for MAUI is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

---
title: Uno
---

Tested with Uno Platform project targeting .NET 10.

## Install

```bash
dotnet add package LCLA
```

## Example

The [Uno Platform example on GitHub](https://github.com/Lightning-Chart/lc-la/tree/master/examples/uno) loads 1,000,000 historical samples and lets you start or stop 10,000-sample real-time batches. Its README walks through running it locally.

## License key

Get a free trial key or use your commercial key, then load the chart into a `WebView2`:

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
chart.SetData(new SetDataOptions
{
    DataSetId = "signals",
    X = samples.Timestamps,
    Columns = new Dictionary<string, double[]> { ["value"] = samples.Values },
});
```

## Real-time data

Append batches received from your application's data source:

```csharp
chart.SetScrollStrategy(new SetScrollStrategyOptions { AxisX = ScrollStrategy.Scrolling });

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

## More features

LightningChart for Uno Platform supports the shared chart, channel, dataset, historical-data, and streaming-data features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for Uno Platform is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

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

LightningChart for MAUI requires a license key. [Get a free trial key](https://lightningchart.com/js-charts/) or use your commercial key. Load the key through the configuration method used by your application. In the example below, `licenseKey` represents that configured value.

Create one license and use it when initializing the shared context after the WebView has loaded:

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

Create the context once and use it to create additional charts.

`AppTitle` and `Company` default to trial values. Set both for app deployment licenses.

In the following examples, `signalService` represents your application's data source and supplies timestamps in milliseconds and signal values as `double[]` arrays.

## Historical data

Load data through your MAUI app's service, file, or API workflow, then replace the dataset:

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

Append batches received from a device, service, or WebSocket. Configure the X axis to follow the latest samples:

```csharp
chart.Update(new UpdateXYChartConfig
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

Cancel streaming when the page is removed. Dispose the chart, context, and transport by calling their `DisposeAsync()` methods.

## Troubleshooting

If the chart cannot start, the chart area shows the error and a **Copy error** button. Include the copied error when requesting support.

## More features

LightningChart for MAUI supports multiple axes, configurable series, datasets, historical data, and streaming data features. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart for MAUI is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

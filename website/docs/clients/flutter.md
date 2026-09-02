---
title: Flutter
---

Use LightningChart Flutter on Web, Android, iOS, and macOS.

## Install

```bash
flutter pub add lightning_chart_flutter
```

Tested with Flutter 3.44.

## Example

The [Flutter example on GitHub](https://github.com/Lightning-Chart/lc-la-example-flutter) loads 1,000,000 historical samples and lets you start or stop 10,000-sample real-time batches. Its README walks through running it locally in Chrome and on native targets.

## License key

LightningChart Flutter requires a license key. Get a free trial key or use your commercial key. A `--dart-define` keeps the key out of source code:

```bash
flutter run -d chrome --dart-define=LCJS_LICENSE_KEY=your-license-key
```

Read it when constructing the widget:

```dart
const licenseKey = String.fromEnvironment('LCJS_LICENSE_KEY');

const license = LclaLicense(
  key: licenseKey,
  appTitle: 'My Flutter App',
  company: 'My Company',
);
```

`appTitle` and `company` default to trial values. Set both for app deployment licenses.

## Historical data

Acquire data through the repository, HTTP client, or file workflow your Flutter application normally uses. Pass the resulting typed arrays as `initialData` when creating the chart.

```dart
final samples = await signalRepository.loadHistoricalSamples();

return LightningChart.xy(
  license: license,
  title: 'Historical signal',
  dataSets: const [
    DataSetConfig(
      id: 'signals',
      maxSampleCount: 2_000_000,
      columns: [DataSetColumnConfig(id: 'value')],
    ),
  ],
  channels: const [
    ChannelConfig(
      id: 'value',
      dataSetId: 'signals',
      column: 'value',
      name: 'Signal',
    ),
  ],
  initialData: [
    SetDataOptions(
      dataSetId: 'signals',
      x: samples.timestamps,
      columns: {'value': samples.values},
    ),
  ],
);
```

`timestamps` and `values` are `Float64List` instances with equal lengths.

## Real-time data

Capture the controller after Flutter mounts the widget, then append batches received from a stream, WebSocket, or device. Configure the X axis to follow the latest data.

```dart
LightningChartController? chart;

LightningChart.xy(
  license: license,
  dataSets: dataSets,
  channels: channels,
  onChartCreated: (createdChart) {
    chart = createdChart;
    chart!.setScrollStrategy(
      const SetScrollStrategyOptions(axisX: ScrollStrategy.scrolling),
    );
    chart!.setDefaultAxisInterval(
      const SetDefaultAxisIntervalOptions(axis: AxisTarget.x, length: 10),
    );
  },
);

signalRepository.liveBatches.listen((batch) {
  chart?.appendData(AppendDataOptions(
    dataSetId: 'signals',
    x: batch.timestamps,
    columns: {'value': batch.values},
  ));
});
```

Cancel the stream subscription in `dispose` when the widget is removed. On Android, add the `INTERNET` permission; if loopback traffic is blocked, allow cleartext traffic to `127.0.0.1` as described in the example README.

## More features

LightningChart Flutter shares the same underlying features as every LightningChart LA client. This page introduces the general syntax and key use cases; for complete client-agnostic feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart Flutter is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

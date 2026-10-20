---
title: Flutter
---

Use LightningChart Flutter on Web, Android, iOS, and macOS.

## Install

```bash
flutter pub add lightning_chart_flutter
```

Tested with Flutter 3.44.

## Examples

Explore the [Flutter examples](https://github.com/Lightning-Chart/lc-la/tree/master/examples/flutter). 
Each example has its own README with instructions for running it locally.

## License key

LightningChart Flutter requires a license key. [Get a free trial key](https://lightningchart.com/js-charts/) or use your commercial key. One way to keep the key out of source code is to provide it with `--dart-define`:

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
      columns: [
        DataSetColumnConfig(
          id: 'time',
          dataPattern: DataPattern.progressive,
        ),
        DataSetColumnConfig(id: 'value'),
      ],
    ),
  ],
  series: const [
    LineScatterSeriesConfig(
      id: 'value',
      dataSetId: 'signals',
      x: 'time',
      y: 'value',
      name: 'Signal',
    ),
  ],
  initialData: [
    SetDataOptions(
      dataSetId: 'signals',
      columns: {
        'time': samples.timestamps,
        'value': samples.values,
      },
    ),
  ],
);
```

`timestamps` and `values` are `Float64List` instances with equal lengths.

## Real-time data

Capture the controller after Flutter mounts the widget, then append batches received from a stream, WebSocket, or device.

```dart
LightningChartController? chart;

LightningChart.xy(
  license: license,
  dataSets: const [
    DataSetConfig(
      id: 'signals',
      maxSampleCount: 2_000_000,
      columns: [
        DataSetColumnConfig(
          id: 'time',
          dataPattern: DataPattern.progressive,
        ),
        DataSetColumnConfig(id: 'value'),
      ],
    ),
  ],
  series: const [
    LineScatterSeriesConfig(
      id: 'value',
      dataSetId: 'signals',
      x: 'time',
      y: 'value',
      name: 'Signal',
    ),
  ],
  onChartCreated: (createdChart) {
    chart = createdChart;
    chart!.setScrollStrategy(
      const SetScrollStrategyOptions(
        axis: AxisTarget.x,
        strategy: ScrollStrategy.scrolling,
      ),
    );
    chart!.setDefaultAxisInterval(
      const SetDefaultAxisIntervalOptions(
        axis: AxisTarget.x,
        length: 10,
      ),
    );
  },
);

signalRepository.liveBatches.listen((batch) {
  chart?.appendData(AppendDataOptions(
    dataSetId: 'signals',
    columns: {
        'time': batch.timestamps,
        'value': batch.values,
    },
  ));
});
```

Cancel the stream subscription in `dispose` when the widget is removed. On Android, add the `INTERNET` permission; if loopback traffic is blocked, allow cleartext traffic to `127.0.0.1` as described in the example README.

## More features

LightningChart Flutter supports multiple axes, configurable series, historical data, and real-time streaming. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart Flutter is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

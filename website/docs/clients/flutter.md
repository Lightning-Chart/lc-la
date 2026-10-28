---
title: Flutter
---

Use LightningChart Flutter on Web, Android, iOS, and macOS.

Tested with Flutter 3.44.

## Install

```bash
flutter pub add lightning_chart_flutter
```

## Example

The [Flutter example on GitHub](https://github.com/Lightning-Chart/lc-la-example-flutter) displays a patient monitoring dashboard with ECG, blood pressure, oxygen saturation, and respiratory rate. Monitor mode shows current measurements, while Review mode shows recording statistics. Its README walks through running it locally.

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
      maxSampleCount: 1_000_000,
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
    LineSeriesConfig(
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

For incoming data from a device, service, or WebSocket, append each received batch to the dataset.

Store the subscription in your widget's state:

```dart
import 'dart:async';

StreamSubscription<dynamic>? _subscription;
```

The following creates a chart with a ten-second scrolling window and starts listening after the chart is ready:

```dart
return LightningChart.xy(
  license: license,
  dataSets: const [
    DataSetConfig(
      id: 'signals',
      maxSampleCount: 1_000_000,
      columns: [
        DataSetColumnConfig(
          id: 'time',
          dataPattern: DataPattern.progressive,
        ),
        DataSetColumnConfig(id: 'value'),
      ],
    ),
  ],
  axes: const [
    AxisConfig(
      axis: AxisTarget.x,
      scrollStrategy: ScrollStrategy.scrolling,
      defaultInterval: AxisDefaultIntervalConfig(
        length: 10_000,
      ),
    ),
  ],
  series: const [
    LineSeriesConfig(
      id: 'value',
      dataSetId: 'signals',
      x: 'time',
      y: 'value',
      name: 'Signal',
    ),
  ],
  onChartCreated: (chart) {
    _subscription = signalRepository.liveBatches.listen((batch) {
      chart.appendData(AppendDataOptions(
        dataSetId: 'signals',
        columns: {
          'time': batch.timestamps,
          'value': batch.values,
        },
      ));
    });
  },
);
```

Cancel the subscription when the widget is removed:

```dart
@override
void dispose() {
  _subscription?.cancel();
  super.dispose();
}
```

The chart widget releases its chart resources automatically.

On Android, add the `INTERNET` permission. If loopback traffic is blocked, allow cleartext traffic to `127.0.0.1` as described in the example README.

## More features

LightningChart Flutter supports multiple axes, configurable series, historical data, and real-time streaming. For complete feature coverage, see [Features](../features/).

## Feedback and contributions

LightningChart Flutter is [open source on GitHub](https://github.com/Lightning-Chart/lc-la). You can contribute an improvement or open an issue, or contact the LightningChart team through [lightningchart.com](https://lightningchart.com/contact/) or at feedback.js@lightningchart.com.

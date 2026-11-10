# LightningChart Flutter Package Example

This example displays temperature measurements from two sensors using LightningChart Flutter:

```dart
LightningChart.xy(
  license: license,
  title: 'Temperature',
  dataSets: [...],
  series: [...],
  initialData: [...],
)
```

Explore the [Flutter examples](https://github.com/Lightning-Chart/lc-la/tree/master/examples/flutter). Each example's README explains how to run it locally.

From this directory:

```bash
flutter create . --platforms=android,ios,macos,web
flutter run -d chrome --dart-define=LIGHTNINGCHART_LICENSE=your-license-key
```

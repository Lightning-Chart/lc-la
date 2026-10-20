# LightningChart Flutter Package Example

This package-local example demonstrates the Flutter-native LCLA API:

```dart
LightningChart.xy(
  license: license,
  title: 'Temperature',
  dataSets: [...],
  channels: [...],
  initialData: [...],
)
```

Explore the [Flutter examples](https://github.com/Lightning-Chart/lc-la/tree/master/examples/flutter). Each example's README explains how to run it locally.

From this directory:

```bash
flutter create . --platforms=android,ios,macos,web
flutter run -d chrome --dart-define=LIGHTNINGCHART_LICENSE=your-license-key
```

The generated platform folders are intentionally not committed. The Dart example app lives in `lib/main.dart`.

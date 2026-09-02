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

The release-facing high-performance repository example lives at `examples/flutter`.

From this directory:

```bash
flutter create . --platforms=android,ios,macos,web
flutter run -d chrome --dart-define=LIGHTNINGCHART_LICENSE=your-license-key
```

The generated platform folders are intentionally not committed. The Dart example app lives in `lib/main.dart`.

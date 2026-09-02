# LightningChart Flutter Example

This is a Flutter application that consumes the published
`lightning_chart_flutter` package from pub.dev. It demonstrates a
1,000,000-point historical load and 10,000-sample streaming batches.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

## Requirements

- Flutter 3.44 or newer.
- A free LightningChart JS trial key or existing commercial key. Get a trial
  key from https://lightningchart.com/js-charts/.

## Run in Chrome

Clone the standalone example repository:

```bash
git clone https://github.com/Lightning-Chart/lc-la-example-flutter.git
cd lc-la-example-flutter
```

Create the web platform project, fetch packages, and run:

```bash
flutter create . --platforms=web --project-name=lightning_chart_flutter_example
flutter pub get
flutter run -d chrome --dart-define=LCJS_LICENSE_KEY=your-license-key
```

`flutter create` is only needed while this repository does not commit generated
platform folders.

To use another available Flutter target, create its platform project and run it:

```bash
flutter create . --platforms=android,ios,macos,web --project-name=lightning_chart_flutter_example
flutter run -d <device-id> --dart-define=LCJS_LICENSE_KEY=your-license-key
```

## Android

The native package uses a local WebView bridge. Add internet permission to
`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

If Android blocks cleartext loopback traffic, add
`android:usesCleartextTraffic="true"` to the `<application>` element, or use a
network-security configuration that allows `127.0.0.1`.

## Using the Demo

1. Select the data icon to load the 1M-point historical dataset.
2. Select play to start 10k-sample streaming batches.
3. Select stop to pause streaming.

The status strip reports the mode, sample count, load state, and runtime errors.

## Troubleshooting

If Chrome is not listed by `flutter devices`, run `flutter doctor -v` and enable
Flutter web support. If the chart reports a license error, verify the key passed
with `--dart-define`.

# LightningChart Flutter Example

This is a Flutter application that consumes the published
`lightning_chart_flutter` package from pub.dev. It displays a patient monitoring dashboard using two datasets. The chart displays ECG, blood pressure, oxygen saturation, and respiratory rate. Metric cards show the current measurements in Monitor mode and recording statistics in Review mode.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

![Flutter example](/examples/flutter/web/lcla_flutter.png)

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

1. Monitor mode starts replay automatically after the recordings load. Select **Pause** to pause, then **Play** to resume.
2. Select **Review** to pause replay and display the complete recordings.
3. Return to **Monitor** to continue from the previous playback position. Playback resumes automatically if it was running before **Review**.

## Troubleshooting

If Chrome is not listed by `flutter devices`, run `flutter doctor -v` and enable
Flutter web support. If the chart reports a license error, verify the key passed
with `--dart-define`.

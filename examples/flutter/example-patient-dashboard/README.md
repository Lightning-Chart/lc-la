# LightningChart Flutter Example

This Flutter example displays a patient monitoring dashboard with stacked
ECG, blood pressure, oxygen saturation, and respiratory-rate sections.
Systolic and diastolic share an axis. Metric cards show the current
measurements in Monitor mode and recording statistics in Review mode.

Learn more: [LightningChart documentation](https://lightningchart.com/lc-la/docs/)

![Flutter example](./images/example_patient_dashboard.png)

## Prerequisites

- Flutter 3.44 or newer
- Google Chrome for the web example
- A free LightningChart JS trial key or existing commercial key. Get a trial key [here](https://lightningchart.com/js-charts/).

## Build and Run

### Standalone repository

1. Clone the standalone example with:
   ```bash
   git clone https://github.com/Lightning-Chart/lc-la-example-flutter.git
   cd lc-la-example-flutter
   ```

2. Fetch packages and run in Chrome with your license key:
   ```bash
   flutter pub get
   flutter run -d chrome --dart-define=LCJS_LICENSE_KEY=your-license-key
   ```

### From the lc-la repository

1. Clone the repository:
   ```bash
   git clone https://github.com/Lightning-Chart/lc-la.git
   cd lc-la
   ```
   If you already have the repository, open a terminal in its root folder.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` in the repository root and set `LCJS_LICENSE_KEY` to your license key.

4. If the example's `web` folder is missing, create it:
   ```bash
   cd examples/flutter/example-patient-dashboard
   flutter create . --platforms=web --project-name=lightning_chart_flutter_example
   cd ../../..
   ```

5. Start the example from the repository root:
   ```bash
   npm run dev
   ```
   Select "Flutter", then "Patient dashboard". Choose "Chrome" if Flutter
   prompts you to select a device.

## Using the Example

1. Monitor mode starts replay automatically after the recordings load.
   Select **Pause** to pause, then **Play** to resume.
2. Select **Review** to pause replay and display the complete recordings.
3. Return to **Monitor** to continue from the previous playback position.
   Playback resumes automatically if it was running before **Review**.

## Android

Connect an Android device with USB debugging enabled, or start an emulator.

### Standalone repository

From the example folder, list available devices:
```bash
flutter devices
```

Replace `DEVICE_ID` with your Android device's identifier and supply your license key:

```bash
flutter run -d DEVICE_ID --dart-define=LCJS_LICENSE_KEY=your-license-key
```

### From the lc-la repository

Run `npm run dev` from the repository root and select
"Flutter", "Patient dashboard", and the Android device.

## Troubleshooting

If Chrome is not listed by `flutter devices`, run `flutter doctor -v` and enable
Flutter web support with `flutter config --enable-web`.

If the chart reports a license error, verify the key passed with
`--dart-define` when running the standalone example, or check `LCJS_LICENSE_KEY`
in the repository root `.env` when using the lc-la runner. Restart the example
after correcting the key.
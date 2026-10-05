import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';

const _licenseKey = String.fromEnvironment(
  'LCJS_LICENSE_KEY',
  defaultValue: 'your-license-key',
);

class _Palette {
  static const background = Color(0xFF1D1A1B);
  static const surface = Color(0xFF292425);
  static const card = Color(0xFF332D2D);
  static const chart = Color(0xFF1B1A1C);
  static const border = Color(0xFF51494A);
  static const textMuted = Color(0xFFC2B8B5);
  static const accent = Color(0xFFEAD58E);
  static const onAccent = Color(0xFF302717);
  static const text = Color(0xFFF1ECE8);
  static const ecg = Color(0xFF7AC9B4);
  static const bloodPressure = Color(0xFFE6A08B);
  static const diastolic = Color(0xFFD9BB8E);
  static const spo2 = Color(0xFF8EB9D9);
  static const respiratoryRate = Color(0xFFB0CB91);
  // Convert the palette color to HEX color used by the channel configuration
  static String chartHex(Color color) =>
      '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
}

void main() => runApp(const PatientDashboardApp());

class PatientDashboardApp extends StatelessWidget {
  const PatientDashboardApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: "LightningChart Flutter",
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: _Palette.background,
      colorScheme: const ColorScheme.dark(
        primary: _Palette.accent,
        onPrimary: _Palette.onAccent,
        secondary: _Palette.accent,
        onSecondary: _Palette.onAccent,
        surface: _Palette.surface,
        onSurface: _Palette.text,
      ),
    ),
    home: const PatientDashboardPage(licenseKey: _licenseKey),
  );
}

enum _DisplayMode { monitor, review }

class PatientDashboardPage extends StatefulWidget {
  const PatientDashboardPage({required this.licenseKey, super.key});

  final String licenseKey;

  @override
  State<PatientDashboardPage> createState() => _PatientDashboardPageState();
}

class _PatientDashboardPageState extends State<PatientDashboardPage> {
  LightningChartController? _chart;
  _PatientData? _patient;
  _EcgData? _ecg;
  _Stats? _reviewStats;
  Timer? _timer;
  final Stopwatch _clock = Stopwatch();
  _DisplayMode _mode = _DisplayMode.monitor;
  Object? _error;
  bool _loading = false;
  bool _playing = false;
  bool _resumeAfterReview = false;
  bool _replayStarted = false;
  int _vitalIndex = 0;
  int _ecgIndex = 0;
  int _metricIndex = -1;
  double _replayTimeMs = 0;
  double _displayTimeMs = 0;
  static const _windowMs = 20000.0;
  static const _tickPeriod = Duration(milliseconds: 40);
  static const _maxAppendSize = 10000;
  final String _patientId = '611055';
  bool get _loaded => _patient != null;

  @override
  void dispose() {
    _timer?.cancel();
    _clock.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _Palette.background,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide =
              constraints.maxWidth >= 900 && constraints.maxHeight >= 600;
          final chart = Container(
            decoration: BoxDecoration(
              color: _Palette.chart,
              border: Border.all(color: _Palette.border),
            ),
            child: _buildChart(),
          );
          final cards = _buildCards();

          if (wide) {
            return Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 10, 10, 0),
                    child: Row(
                      children: [
                        Expanded(child: chart),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 220,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(0, 20, 0, 34),
                            child: Column(
                              children: [
                                for (final card in cards)
                                  Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: card,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                _buildFooter(),
              ],
            );
          }

          return SingleChildScrollView(
            child: Column(
              children: [
                _buildHeader(),
                SizedBox(
                  height: 550,
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: chart,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Wrap(spacing: 8, runSpacing: 8, children: cards),
                ),
                _buildFooter(),
              ],
            ),
          );
        },
      ),
    ),
  );

  Widget _buildHeader() => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    color: _Palette.surface,
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 16,
      runSpacing: 8,
      children: [
        const Text(
          'Patient vital signs',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SegmentedButton<_DisplayMode>(
              segments: const [
                ButtonSegment(
                  value: _DisplayMode.monitor,
                  label: Text('Monitor'),
                ),
                ButtonSegment(
                  value: _DisplayMode.review,
                  label: Text('Review'),
                ),
              ],
              selected: {_mode},
              onSelectionChanged: _loaded
                  ? (selection) => _selectMode(selection.first)
                  : null,
            ),
            FilledButton.icon(
              onPressed: _loaded && _mode == _DisplayMode.monitor && !_loading
                  ? (_playing ? _pauseReplay : _startReplay)
                  : null,
              icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
              label: Text(_playing ? 'Pause' : 'Play'),
            ),
          ],
        ),
      ],
    ),
  );

  Widget _buildChart() => LightningChart.xy(
    license: LclaLicense(key: widget.licenseKey),
    title: '',
    animationsEnabled: true,
    dataSets: const [
      DataSetConfig(
        id: 'ecg',
        xDataPattern: DataPattern.progressive,
        maxSampleCount: 2000000,
        columns: [DataSetColumnConfig(id: 'lead')],
      ),
      DataSetConfig(
        id: 'vitals',
        xDataPattern: DataPattern.progressive,
        maxSampleCount: 1800,
        columns: [
          DataSetColumnConfig(id: 'heart-rate'),
          DataSetColumnConfig(id: 'systolic'),
          DataSetColumnConfig(id: 'diastolic'),
          DataSetColumnConfig(id: 'spo2'),
          DataSetColumnConfig(id: 'respiratory-rate'),
        ],
      ),
    ],
    channels: [
      ChannelConfig(
        id: 'ecg',
        dataSetId: 'ecg',
        column: 'lead',
        name: 'ECG',
        color: _Palette.chartHex(_Palette.ecg),
        stackIndex: 0,
      ),
      ChannelConfig(
        id: 'systolic',
        dataSetId: 'vitals',
        column: 'systolic',
        name: 'Systolic (mmHg)',
        color: _Palette.chartHex(_Palette.bloodPressure),
        stackIndex: -1,
      ),
      ChannelConfig(
        id: 'diastolic',
        dataSetId: 'vitals',
        column: 'diastolic',
        name: 'Diastolic (mmHg)',
        color: _Palette.chartHex(_Palette.diastolic),
        stackIndex: -1,
      ),
      ChannelConfig(
        id: 'spo2',
        dataSetId: 'vitals',
        column: 'spo2',
        name: 'SpO₂ (%)',
        color: _Palette.chartHex(_Palette.spo2),
        stackIndex: -2,
      ),
      ChannelConfig(
        id: 'respiratory-rate',
        dataSetId: 'vitals',
        column: 'respiratory-rate',
        name: 'Respiratory rate (/min)',
        color: _Palette.chartHex(_Palette.respiratoryRate),
        stackIndex: -3,
      ),
    ],
    onChartCreated: (chart) {
      _chart = chart;
      if (mounted) unawaited(_initializeAndReplay());
    },
    onError: (error, _) => _showError(error),
  );

  List<Widget> _buildCards() {
    final patient = _patient;
    final index = _metricIndex;
    final reviewing = _mode == _DisplayMode.review;
    final stats = reviewing ? _reviewStats : null;
    String number(String key, int digits) => patient == null || index < 0
        ? '—'
        : patient.columns[key]![index].toStringAsFixed(digits);
    final systolic = patient == null || index < 0
        ? null
        : patient.columns['systolic']![index];
    final diastolic = patient == null || index < 0
        ? null
        : patient.columns['diastolic']![index];
    final pressure = systolic == null || diastolic == null
        ? '—'
        : '${systolic.round()}/${diastolic.round()}';
    final bpDetail = systolic == null || diastolic == null
        ? 'MAP and pulse pressure'
        : 'MAP ≈ ${((systolic + 2 * diastolic) / 3).round()} · '
              'Pulse pressure ${(systolic - diastolic).round()}';
    String average(String key, int digits) =>
        stats?.mean(key).toStringAsFixed(digits) ?? '—';
    String range(String key, int digits, String unit) => stats == null
        ? ''
        : 'Low ${stats.min(key).toStringAsFixed(digits)} · '
              'High ${stats.max(key).toStringAsFixed(digits)} $unit';
    return [
      _MetricCard(
        label: reviewing ? 'Heart rate · Average' : 'Heart rate',
        value: reviewing ? average('heart-rate', 0) : number('heart-rate', 0),
        unit: 'bpm',
        color: _Palette.ecg,
        detail: reviewing ? range('heart-rate', 0, 'bpm') : '',
      ),
      _MetricCard(
        label: reviewing ? 'Blood pressure · Average' : 'Blood pressure',
        value: reviewing && stats != null
            ? '${stats.mean('systolic').round()}/${stats.mean('diastolic').round()}'
            : reviewing
            ? '—'
            : pressure,
        unit: 'mmHg',
        color: _Palette.bloodPressure,
        detail: reviewing && stats != null
            ? 'Low ${stats.min('systolic').round()}/${stats.min('diastolic').round()} · '
                  'High ${stats.max('systolic').round()}/${stats.max('diastolic').round()}'
            : reviewing
            ? ''
            : bpDetail,
      ),
      _MetricCard(
        label: reviewing ? 'SpO₂ · Average' : 'SpO₂',
        value: reviewing ? average('spo2', 1) : number('spo2', 1),
        unit: '%',
        color: _Palette.spo2,
        detail: reviewing ? range('spo2', 1, '%') : '',
      ),
      _MetricCard(
        label: reviewing ? 'Respiratory rate · Average' : 'Respiratory rate',
        value: reviewing
            ? average('respiratory-rate', 1)
            : number('respiratory-rate', 1),
        unit: '/min',
        color: _Palette.respiratoryRate,
        detail: reviewing ? range('respiratory-rate', 1, '/min') : '',
      ),
    ];
  }

  Widget _buildFooter() => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
    color: _Palette.surface,
    child: Text(
      _error != null
          ? 'Chart error: $_error'
          : _loading
          ? 'Loading patient recording…'
          : _mode == _DisplayMode.review
          ? 'PATID: $_patientId · ${_formatTime(_patient!.time.first)} – ${_formatTime(_patient!.time.last)}'
          : _playing
          ? 'PATID: $_patientId · ${_formatTime(_displayTimeMs)}'
          : _replayStarted
          ? 'PATID: $_patientId · ${_formatTime(_replayTimeMs)}'
          : 'Preparing chart…',
      textAlign: TextAlign.center,
      style: TextStyle(
        color: _error == null ? _Palette.textMuted : const Color(0xFFFFB4AB),
      ),
    ),
  );

  String _formatTime(double timeMs) {
    final time = _patient!.date.add(Duration(milliseconds: timeMs.round()));
    String two(int value) => value.toString().padLeft(2, '0');
    return '${time.month}/${time.day}/${time.year} '
        '${two(time.hour)}:${two(time.minute)}:${two(time.second)}';
  }

  Future<void> _initializeAndReplay() async {
    final chart = _chart;
    if (chart == null || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final patient = await _PatientData.load();
      final ecg = await _EcgData.load();
      if (!mounted) return;
      chart.setAxisInterval(
        const SetAxisIntervalOptions(axis: AxisTarget.y, start: -0.4, end: 1.2),
      );
      chart.setTickStrategy(
        const SetTickStrategyOptions(
          axis: AxisTarget.x,
          strategy: TickStrategy.time,
        ),
      );
      setState(() {
        _patient = patient;
        _ecg = ecg;
        _reviewStats = _Stats.fromPatient(patient);
        _replayStarted = false;
        _vitalIndex = 0;
        _ecgIndex = 0;
        _metricIndex = -1;
        _replayTimeMs = patient.time.first;
        _displayTimeMs = patient.time.first;
      });
    } catch (error) {
      _showError(error);
      return;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
    if (mounted) _startReplay();
  }

  void _setFullData(
    LightningChartController chart,
    _PatientData patient,
    _EcgData ecg,
  ) {
    chart.setScrollStrategy(
      const SetScrollStrategyOptions(axisX: ScrollStrategy.fitting),
    );
    chart.setData(
      SetDataOptions(
        dataSetId: 'ecg',
        x: ecg.time,
        columns: {'lead': ecg.lead},
      ),
    );
    chart.setData(
      SetDataOptions(
        dataSetId: 'vitals',
        x: patient.time,
        columns: patient.columns,
      ),
    );
  }

  void _selectMode(_DisplayMode mode) {
    if (mode == _mode) return;
    final chart = _chart;
    final patient = _patient;
    final ecg = _ecg;
    if (chart == null || patient == null || ecg == null) {
      return;
    }
    if (mode == _DisplayMode.review) {
      _resumeAfterReview = _playing;
      _stopClock();
      _setFullData(chart, patient, ecg);
      setState(() {
        _mode = mode;
        _playing = false;
      });
      return;
    }
    chart.clearData(const ClearDataOptions(dataSetId: 'ecg'));
    chart.clearData(const ClearDataOptions(dataSetId: 'vitals'));
    _configureReplayAxis(chart);
    if (_ecgIndex > 0) {
      chart.appendData(
        AppendDataOptions(
          dataSetId: 'ecg',
          x: Float64List.sublistView(ecg.time, 0, _ecgIndex),
          columns: {'lead': Float64List.sublistView(ecg.lead, 0, _ecgIndex)},
        ),
      );
    }
    if (_vitalIndex > 0) {
      chart.appendData(
        AppendDataOptions(
          dataSetId: 'vitals',
          x: Float64List.sublistView(patient.time, 0, _vitalIndex),
          columns: {
            for (final entry in patient.columns.entries)
              entry.key: Float64List.sublistView(entry.value, 0, _vitalIndex),
          },
        ),
      );
    }
    chart.setAxisInterval(
      SetAxisIntervalOptions(
        axis: AxisTarget.x,
        start: math.max(patient.time.first, _replayTimeMs - _windowMs),
        end: math.max(patient.time.first + _windowMs, _replayTimeMs),
        stopAxisAfter: false,
      ),
    );
    setState(() {
      _mode = mode;
      _metricIndex = _vitalIndex - 1;
    });
    if (_resumeAfterReview) _startReplay();
    _resumeAfterReview = false;
  }

  void _configureReplayAxis(LightningChartController chart) {
    chart.setScrollStrategy(
      const SetScrollStrategyOptions(axisX: ScrollStrategy.scrolling),
    );
    chart.setDefaultAxisInterval(
      const SetDefaultAxisIntervalOptions(
        axis: AxisTarget.x,
        length: _windowMs,
      ),
    );
  }

  void _startReplay() {
    final chart = _chart;
    final patient = _patient;
    final ecg = _ecg;
    if (chart == null ||
        patient == null ||
        ecg == null ||
        _playing ||
        _mode != _DisplayMode.monitor) {
      return;
    }
    if (!_replayStarted) _restartReplay(chart);
    _clock.reset();
    _clock.start();
    setState(() {
      _playing = true;
      _error = null;
    });
    _appendTick();
    if (_playing) _timer = Timer.periodic(_tickPeriod, (_) => _appendTick());
  }

  void _appendTick() {
    final chart = _chart;
    final patient = _patient;
    final ecg = _ecg;
    if (chart == null || patient == null || ecg == null) {
      _pauseReplay();
      return;
    }
    try {
      final currentTimeMs = (_replayTimeMs + _clock.elapsedMilliseconds).clamp(
        patient.time.first,
        patient.time.last,
      );
      final start = _vitalIndex;
      while (_vitalIndex < patient.time.length &&
          patient.time[_vitalIndex] <= currentTimeMs) {
        _vitalIndex++;
      }
      final ecgEndTime = _vitalIndex == 0
          ? -1.0
          : patient.time[_vitalIndex - 1];
      while (_ecgIndex < ecg.time.length && ecg.time[_ecgIndex] <= ecgEndTime) {
        final ecgStart = _ecgIndex;
        while (_ecgIndex < ecg.time.length &&
            ecg.time[_ecgIndex] <= ecgEndTime &&
            _ecgIndex - ecgStart < _maxAppendSize) {
          _ecgIndex++;
        }
        chart.appendData(
          AppendDataOptions(
            dataSetId: 'ecg',
            x: Float64List.sublistView(ecg.time, ecgStart, _ecgIndex),
            columns: {
              'lead': Float64List.sublistView(ecg.lead, ecgStart, _ecgIndex),
            },
          ),
        );
      }
      if (_vitalIndex > start) {
        chart.appendData(
          AppendDataOptions(
            dataSetId: 'vitals',
            x: Float64List.sublistView(patient.time, start, _vitalIndex),
            columns: {
              for (final entry in patient.columns.entries)
                entry.key: Float64List.sublistView(
                  entry.value,
                  start,
                  _vitalIndex,
                ),
            },
          ),
        );
      }
      if (_vitalIndex > start) {
        setState(() {
          _metricIndex = _vitalIndex - 1;
          _displayTimeMs = currentTimeMs;
        });
      }
      if (currentTimeMs >= patient.time.last) {
        _restartReplay(chart);
      }
    } catch (error) {
      _pauseReplay();
      _showError(error);
    }
  }

  void _restartReplay(LightningChartController chart) {
    final startTimeMs = _patient!.time.first;
    chart.clearData(const ClearDataOptions(dataSetId: 'ecg'));
    chart.clearData(const ClearDataOptions(dataSetId: 'vitals'));
    _configureReplayAxis(chart);
    chart.setAxisInterval(
      SetAxisIntervalOptions(
        axis: AxisTarget.x,
        start: startTimeMs,
        end: startTimeMs + _windowMs,
        stopAxisAfter: false,
      ),
    );
    _clock.reset();
    _vitalIndex = 0;
    _ecgIndex = 0;
    _replayTimeMs = startTimeMs;
    _replayStarted = true;
    if (mounted) {
      setState(() {
        _metricIndex = -1;
        _displayTimeMs = startTimeMs;
      });
    }
  }

  void _pauseReplay() {
    _stopClock();
    if (mounted) setState(() => _playing = false);
  }

  void _stopClock() {
    _timer?.cancel();
    _timer = null;
    if (_clock.isRunning) {
      final patient = _patient!;
      _replayTimeMs = (_replayTimeMs + _clock.elapsedMilliseconds).clamp(
        patient.time.first,
        patient.time.last,
      );
      _clock.stop();
    }
  }

  void _showError(Object error) {
    if (mounted) setState(() => _error = error);
  }
}

class _EcgData {
  const _EcgData(this.time, this.lead);
  final Float64List time;
  final Float64List lead;
  static Future<_EcgData> load() async {
    final csv = await rootBundle.loadString('assets/ecg_patient10.csv');
    final time = <double>[];
    final lead = <double>[];
    for (final row in csv.trim().split('\n').skip(1)) {
      final cells = row.split(',');
      time.add(double.parse(cells[0].trim()));
      lead.add(double.parse(cells[2].trim()));
    }
    return _EcgData(Float64List.fromList(time), Float64List.fromList(lead));
  }
}

class _PatientData {
  const _PatientData(this.date, this.time, this.columns);

  final DateTime date;
  final Float64List time;
  final Map<String, Float64List> columns;
  static Future<_PatientData> load() async {
    final csv = await rootBundle.loadString('assets/patient_10.csv');
    final rows = csv.trim().split('\n').skip(1);
    final date = DateTime.parse(rows.first.split(',')[1].trim());
    final values = List.generate(6, (_) => <double>[]);
    for (final row in rows) {
      final cells = row.split(',');
      values[0].add(double.parse(cells[0].trim()));
      for (var i = 1; i < 6; i++) {
        values[i].add(double.parse(cells[i + 1].trim()));
      }
    }
    return _PatientData(date, Float64List.fromList(values[0]), {
      'heart-rate': Float64List.fromList(values[1]),
      'systolic': Float64List.fromList(values[2]),
      'diastolic': Float64List.fromList(values[3]),
      'spo2': Float64List.fromList(values[4]),
      'respiratory-rate': Float64List.fromList(values[5]),
    });
  }
}

class _Stats {
  const _Stats(this._values);
  final Map<String, ({double min, double max, double mean})> _values;
  double min(String key) => _values[key]!.min;
  double max(String key) => _values[key]!.max;
  double mean(String key) => _values[key]!.mean;
  factory _Stats.fromPatient(_PatientData data) {
    final values = <String, ({double min, double max, double mean})>{};
    for (final entry in data.columns.entries) {
      var low = double.infinity;
      var high = double.negativeInfinity;
      var sum = 0.0;
      for (final value in entry.value) {
        low = math.min(low, value);
        high = math.max(high, value);
        sum += value;
      }
      values[entry.key] = (min: low, max: high, mean: sum / entry.value.length);
    }
    return _Stats(values);
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.unit,
    required this.color,
    required this.detail,
  });
  final String label;
  final String value;
  final String unit;
  final Color color;
  final String detail;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 106, minWidth: 190),
    width: 220,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: _Palette.card,
      border: Border.all(color: _Palette.border),
    ),
    child: Row(
      children: [
        Container(width: 4, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: _Palette.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 5),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  '$value $unit',
                  style: const TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (detail.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(
                  detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _Palette.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

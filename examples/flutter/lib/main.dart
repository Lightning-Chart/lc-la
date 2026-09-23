import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';

const _lightningChartLicenseKey = String.fromEnvironment(
  'LCJS_LICENSE_KEY',
  defaultValue: 'your-license-key',
);

void main() {
  runApp(const LightningChartFlutterExample());
}

class LightningChartFlutterExample extends StatelessWidget {
  const LightningChartFlutterExample({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00A6FF),
          brightness: Brightness.dark,
        ),
      ),
      home: const SignalMonitorPage(licenseKey: _lightningChartLicenseKey),
    );
  }
}

class SignalMonitorPage extends StatefulWidget {
  const SignalMonitorPage({required this.licenseKey, super.key});
  final String licenseKey;
  @override
  State<SignalMonitorPage> createState() => _SignalMonitorPageState();
}

class _SignalMonitorPageState extends State<SignalMonitorPage> {
  static const _sampleRate = 1000;
  static const _streamBatchSize = 20;
  static const _streamPeriod = Duration(milliseconds: 20);
  static const _visibleWindowSeconds = 2.0;
  LightningChartController? _chart;
  Float64List? _ecgSamples;
  Timer? _streamTimer;
  var _isStreaming = false;
  var _historicalLoaded = false;
  var _sampleCount = 0;
  var _streamIndex = 0;
  var _nextX = 0.0;
  Object? _lastError;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF080A0D),
      appBar: AppBar(
        title: const Text('LightningChart Flutter'),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'Load historical data',
            onPressed: _chart == null || _isStreaming
                ? null
                : _loadHistoricalData,
            icon: const Icon(Icons.data_array),
          ),
          IconButton(
            tooltip: _isStreaming ? 'Stop streaming' : 'Start streaming',
            onPressed: _chart == null || _ecgSamples == null
                ? null
                : (_isStreaming ? _stopStreaming : _startStreaming),
            icon: Icon(_isStreaming ? Icons.stop : Icons.play_arrow),
          ),
        ],
      ),
      body: Column(
        children: [
          _StatusStrip(
            historicalLoaded: _historicalLoaded,
            isStreaming: _isStreaming,
            sampleCount: _sampleCount,
            lastError: _lastError,
          ),
          Expanded(
            child: LightningChart.xy(
              license: LightningChartLicense(
                key: widget.licenseKey,
                appTitle: 'LightningChart JS Trial',
                company: 'LightningChart Ltd.',
              ),
              title: 'ECG Signal Monitor — 1,000 Hz',
              animationsEnabled: false,
              dataSets: const [
                DataSetConfig(
                  id: 'ecg',
                  maxSampleCount: 2000000,
                  columns: [DataSetColumnConfig(id: 'lead')],
                ),
              ],
              channels: const [
                ChannelConfig(
                  id: 'lead',
                  dataSetId: 'ecg',
                  column: 'lead',
                  name: 'ECG lead',
                  color: '#65D18A',
                ),
              ],
              onChartCreated: (chart) {
                setState(() {
                  _chart = chart;
                });
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) {
                    unawaited(_loadHistoricalData());
                  }
                });
              },
              onError: (error, _) {
                setState(() {
                  _lastError = error;
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _streamTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadHistoricalData() async {
    final chart = _chart;
    if (chart == null) {
      return;
    }

    _streamTimer?.cancel();
    _streamTimer = null;

    try {
      final csv = await rootBundle.loadString('assets/ecg_1000.csv');
      final values = csv
          .split(RegExp(r'\r?\n'))
          .skip(1)
          .where((line) => line.trim().isNotEmpty)
          .map((line) => double.parse(line.trim()))
          .toList();

      if (values.isEmpty) {
        throw const FormatException('The ECG dataset is empty.');
      }

      final samples = Float64List.fromList(values);
      final x = Float64List(samples.length);
      for (var i = 0; i < x.length; i++) {
        x[i] = i / _sampleRate;
      }

      chart.setScrollStrategy(
        const SetScrollStrategyOptions(axisX: ScrollStrategy.fitting),
      );
      chart.setData(
        SetDataOptions(dataSetId: 'ecg', x: x, columns: {'lead': samples}),
      );
      chart.setAxisInterval(
        SetAxisIntervalOptions(axis: AxisTarget.x, start: 0, end: x.last),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _ecgSamples = samples;
        _historicalLoaded = true;
        _isStreaming = false;
        _sampleCount = samples.length;
        _streamIndex = 0;
        _nextX = x.last + 1 / _sampleRate;
        _lastError = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _lastError = error;
        });
      }
    }
  }

  void _startStreaming() {
    final chart = _chart;
    final samples = _ecgSamples;
    if (chart == null || samples == null || _isStreaming) {
      return;
    }

    chart.setScrollStrategy(
      const SetScrollStrategyOptions(axisX: ScrollStrategy.scrolling),
    );
    chart.setDefaultAxisInterval(
      const SetDefaultAxisIntervalOptions(
        axis: AxisTarget.x,
        length: _visibleWindowSeconds,
      ),
    );

    setState(() {
      _isStreaming = true;
      _lastError = null;
    });

    _streamTimer = Timer.periodic(_streamPeriod, (_) {
      final x = Float64List(_streamBatchSize);
      final lead = Float64List(_streamBatchSize);

      for (var i = 0; i < _streamBatchSize; i++) {
        x[i] = _nextX;
        lead[i] = samples[_streamIndex];
        _nextX += 1 / _sampleRate;
        _streamIndex = (_streamIndex + 1) % samples.length;
      }

      chart.appendData(
        AppendDataOptions(dataSetId: 'ecg', x: x, columns: {'lead': lead}),
      );

      final previousSampleCount = _sampleCount;
      _sampleCount += _streamBatchSize;
      if (_sampleCount ~/ _sampleRate != previousSampleCount ~/ _sampleRate &&
          mounted) {
        setState(() {});
      }
    });
  }

  void _stopStreaming() {
    _streamTimer?.cancel();
    _streamTimer = null;
    setState(() {
      _isStreaming = false;
    });
  }
}

class _StatusStrip extends StatelessWidget {
  const _StatusStrip({
    required this.historicalLoaded,
    required this.isStreaming,
    required this.sampleCount,
    required this.lastError,
  });

  final bool historicalLoaded;
  final bool isStreaming;
  final int sampleCount;
  final Object? lastError;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF10151B),
        border: Border(bottom: BorderSide(color: Color(0xFF222B35))),
      ),
      child: Row(
        children: [
          _Metric(label: 'Mode', value: isStreaming ? 'Live' : 'Historical'),
          _Metric(label: 'Samples', value: _formatCount(sampleCount)),
          _Metric(
            label: 'Recording',
            value: historicalLoaded ? 'Loaded' : 'Empty',
          ),
          const Spacer(),
          if (lastError != null)
            Flexible(
              child: Text(
                lastError.toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodySmall?.copyWith(
                  color: const Color(0xFFFFB4AB),
                ),
              ),
            ),
        ],
      ),
    );
  }

  static String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(0)}k';
    }
    return count.toString();
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SizedBox(
      width: 132,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: textTheme.labelSmall?.copyWith(
              color: const Color(0xFF8C98A4),
            ),
          ),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: textTheme.titleMedium?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

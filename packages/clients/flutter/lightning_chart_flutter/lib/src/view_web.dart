import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:web/web.dart' as web;

import 'bij.dart';
import 'chart_session.dart';
import 'models.dart';

typedef LclaChartReady =
    FutureOr<void> Function(LclaChartSession session, LclaChart chart);
typedef LclaErrorHandler =
    void Function(LclaError error, StackTrace stackTrace);
typedef LclaErrorBuilder =
    Widget Function(BuildContext context, LclaError error);

class LclaChartView extends StatefulWidget {
  const LclaChartView({
    required this.license,
    this.initialConfig,
    this.onChartReady,
    this.onError,
    this.errorBuilder,
    super.key,
  });

  final LclaLicense license;
  final XYChartConfig? initialConfig;
  final LclaChartReady? onChartReady;
  final LclaErrorHandler? onError;
  final LclaErrorBuilder? errorBuilder;

  @override
  State<LclaChartView> createState() => _LclaChartViewState();
}

class _LclaChartViewState extends State<LclaChartView> {
  static var _nextContainerId = 0;

  final String _containerId = 'lcla-flutter-web-${++_nextContainerId}';
  LclaChartSession? _client;
  LclaChart? _chart;
  var _initialized = false;
  LclaError? _error;

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      return widget.errorBuilder?.call(context, error) ??
          _DefaultErrorView(error: error);
    }
    return HtmlElementView.fromTagName(
      tagName: 'div',
      onElementCreated: _onElementCreated,
    );
  }

  @override
  void dispose() {
    _chart?.dispose();
    unawaited(_client?.dispose());
    super.dispose();
  }

  void _onElementCreated(Object element) {
    final div = element as web.HTMLDivElement;
    div.id = _containerId;
    div.style
      ..width = '100%'
      ..height = '100%'
      ..minHeight = '1px'
      ..backgroundColor = '#000'
      ..overflow = 'hidden';
    unawaited(_initializeWhenAttached());
  }

  Future<void> _initializeWhenAttached() async {
    while (mounted && web.document.getElementById(_containerId) == null) {
      final nextFrame = Completer<void>();
      web.window.requestAnimationFrame(((num _) => nextFrame.complete()).toJS);
      await nextFrame.future;
    }

    if (mounted) {
      await _initialize();
    }
  }

  Future<void> _initialize() async {
    if (_initialized) {
      return;
    }
    _initialized = true;

    try {
      await _LclaWebHost.ensureLoaded();
      final transport = _LclaWebTransport();
      final client = LclaChartSession(transport, widget.license);
      final chart = await client.createChart(
        (widget.initialConfig ?? const XYChartConfig()).copyWith(
          containerId: _containerId,
        ),
      );

      if (!mounted) {
        chart.dispose();
        await client.dispose();
        return;
      }

      _client = client;
      _chart = chart;
      await widget.onChartReady?.call(client, chart);
    } catch (error, stackTrace) {
      final lclaError = _asLclaError(error, stackTrace);
      if (mounted) setState(() => _error = lclaError);
      widget.onError?.call(lclaError, stackTrace);
    }
  }
}

LclaError _asLclaError(Object error, StackTrace stackTrace) =>
    error is LclaError
    ? error
    : LclaError(
        category: LclaErrorCategory.initialization,
        summary: 'LightningChart could not start.',
        details: '$error\n\n$stackTrace',
        canContinue: false,
      );

class _DefaultErrorView extends StatelessWidget {
  const _DefaultErrorView({required this.error});
  final LclaError error;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: const Color(0xff10151b),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            error.summary,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () =>
                Clipboard.setData(ClipboardData(text: error.toString())),
            icon: const Icon(Icons.copy),
            label: const Text('Copy error'),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: SingleChildScrollView(
              child: SelectableText(
                error.toString(),
                style: const TextStyle(color: Colors.white70),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _LclaWebTransport implements LclaTransport {
  @override
  Future<Map<String, Object?>> send(String id, Uint8List message) async {
    return _process(message);
  }

  @override
  void sendFireAndForget(Uint8List message) {
    _process(message);
  }

  @override
  void discardPending() {}

  Map<String, Object?> _process(Uint8List message) {
    final helper = web.window.getProperty<JSObject>('__lcla_flutter'.toJS);
    final response = helper.callMethod<JSUint8Array>(
      'processMessage'.toJS,
      message.toJS,
    );
    final bytes = response.toDart;
    final decoded = bijDecode(bytes);
    return Map<String, Object?>.from(decoded['meta']! as Map);
  }
}

class _LclaWebHost {
  static Completer<void>? _loadCompleter;

  static Future<void> ensureLoaded() {
    final existing = _loadCompleter;
    if (existing != null) {
      return existing.future;
    }

    final completer = Completer<void>();
    _loadCompleter = completer;
    unawaited(_load(completer));
    return completer.future;
  }

  static Future<void> _load(Completer<void> completer) async {
    try {
      if (web.window.hasProperty('__lcla'.toJS).toDart) {
        _installHelper();
        completer.complete();
        return;
      }

      final scriptText = await rootBundle.loadString(
        'packages/lightning_chart_flutter/assets/lcla-host.js',
      );
      final script = web.HTMLScriptElement()
        ..type = 'application/javascript'
        ..text = scriptText;
      web.document.head!.append(script);
      _installHelper();
      completer.complete();
    } catch (error, stackTrace) {
      completer.completeError(error, stackTrace);
    }
  }

  static void _installHelper() {
    if (web.window.hasProperty('__lcla_flutter'.toJS).toDart) {
      return;
    }

    final helperScript = web.HTMLScriptElement()
      ..type = 'application/javascript'
      ..text = '''
window.__lcla_flutter = {
  processMessage: function(data) {
    var bytes = data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : Uint8Array.from(data);
    var buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    var response = window.__lcla.processMessage(buffer);
    return new Uint8Array(response);
  }
};
''';
    web.document.head!.append(helperScript);
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'bridge.dart';
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
  WebViewController? _webViewController;
  LclaWebViewBridge? _bridge;
  LclaChartSession? _client;
  LclaChart? _chart;
  LclaError? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_initialize());
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      return widget.errorBuilder?.call(context, error) ??
          _DefaultErrorView(error: error);
    }
    final controller = _webViewController;
    if (controller == null) {
      return const ColoredBox(color: Colors.black);
    }
    return WebViewWidget(controller: controller);
  }

  @override
  void dispose() {
    _chart?.dispose();
    unawaited(_client?.dispose());
    unawaited(_bridge?.dispose());
    super.dispose();
  }

  Future<void> _initialize() async {
    try {
      final bridge = await LclaWebViewBridge.start();
      final controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(Colors.black)
        ..loadRequest(bridge.uri);

      if (!mounted) {
        await bridge.dispose();
        return;
      }

      setState(() {
        _bridge = bridge;
        _webViewController = controller;
      });

      await bridge.ready;
      final client = LclaChartSession(bridge, widget.license);
      final chart = await client.createChart(
        (widget.initialConfig ?? const XYChartConfig()).copyWith(
          containerId: 'lcla-root',
        ),
      );

      if (!mounted) {
        chart.dispose();
        await client.dispose();
        await bridge.dispose();
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

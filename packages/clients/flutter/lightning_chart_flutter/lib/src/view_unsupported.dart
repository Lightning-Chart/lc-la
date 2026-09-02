import 'dart:async';

import 'package:flutter/material.dart';

import 'chart_session.dart';
import 'models.dart';

typedef LclaChartReady =
    FutureOr<void> Function(LclaChartSession session, LclaChart chart);
typedef LclaErrorHandler =
    void Function(LclaError error, StackTrace stackTrace);
typedef LclaErrorBuilder =
    Widget Function(BuildContext context, LclaError error);

class LclaChartView extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final error = const LclaError(
      category: LclaErrorCategory.initialization,
      summary: 'LightningChart is not available on this platform.',
      details: 'Use a supported Flutter Web or WebView target.',
      canContinue: false,
    );
    return errorBuilder?.call(context, error) ??
        Center(child: SelectableText(error.toString()));
  }
}

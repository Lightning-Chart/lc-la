import 'package:flutter/widgets.dart';

import 'chart_session.dart';
import 'models.dart';
import 'view.dart';

typedef LightningChartCreated = void Function(LclaChart chart);

class LightningChart extends StatefulWidget {
  const LightningChart({
    required this.license,
    required this.config,
    this.initialData = const [],
    this.onChartCreated,
    this.onError,
    this.errorBuilder,
    super.key,
  });

  LightningChart.xy({
    required LclaLicense license,
    String? title,
    List<DataSetConfig> dataSets = const [],
    List<AxisConfig> axes = const [],
    List<SeriesConfig> series = const [],
    List<SetDataOptions> initialData = const [],
    bool? animationsEnabled,
    LightningChartCreated? onChartCreated,
    LclaErrorHandler? onError,
    LclaErrorBuilder? errorBuilder,
    Key? key,
  }) : this(
         key: key,
         license: license,
         config: XYChartConfig(
           title: title,
           dataSets: dataSets,
           axes: axes,
           series: series,
           animationsEnabled: animationsEnabled,
         ),
         initialData: initialData,
         onChartCreated: onChartCreated,
         onError: onError,
         errorBuilder: errorBuilder,
       );

  final LclaLicense license;
  final XYChartConfig config;
  final List<SetDataOptions> initialData;
  final LightningChartCreated? onChartCreated;
  final LclaErrorHandler? onError;
  final LclaErrorBuilder? errorBuilder;

  @override
  State<LightningChart> createState() => _LightningChartState();
}

class _LightningChartState extends State<LightningChart> {
  LclaChart? _chart;

  @override
  Widget build(BuildContext context) {
    return LclaChartView(
      license: widget.license,
      initialConfig: widget.config,
      onError: widget.onError,
      errorBuilder: widget.errorBuilder,
      onChartReady: (_, chart) {
        _chart = chart;
        _applyInitialData(chart);
        widget.onChartCreated?.call(chart);
      },
    );
  }

  @override
  void didUpdateWidget(covariant LightningChart oldWidget) {
    super.didUpdateWidget(oldWidget);

    final chart = _chart;
    if (chart == null) return;

    // Send changed configuration sections together in one update.
    final update = UpdateXYChartConfig(
      title: widget.config.title != oldWidget.config.title
          ? widget.config.title
          : null,
      dataSets: !identical(widget.config.dataSets, oldWidget.config.dataSets)
          ? widget.config.dataSets
          : null,
      axes: !identical(widget.config.axes, oldWidget.config.axes)
          ? widget.config.axes
          : null,
      series: !identical(widget.config.series, oldWidget.config.series)
          ? widget.config.series
          : null,
    );

    if (update.title != null ||
        update.dataSets != null ||
        update.axes != null ||
        update.series != null) {
      chart.update(update);
    }

    if (!identical(widget.initialData, oldWidget.initialData)) {
      _applyInitialData(chart);
    }
  }

  void _applyInitialData(LclaChart chart) {
    for (final data in widget.initialData) {
      chart.setData(data);
    }
  }
}

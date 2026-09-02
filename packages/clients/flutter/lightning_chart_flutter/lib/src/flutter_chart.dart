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
    List<ChannelConfig> channels = const [],
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
           channels: channels,
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
    if (chart == null) {
      return;
    }

    if (!identical(widget.config.dataSets, oldWidget.config.dataSets) &&
        widget.config.dataSets != null) {
      chart.configureDataSets(widget.config.dataSets!);
    }
    if (!identical(widget.config.channels, oldWidget.config.channels) &&
        widget.config.channels != null) {
      chart.configureChannels(widget.config.channels!);
    }
    if (widget.config.title != oldWidget.config.title &&
        widget.config.title != null) {
      chart.setTitle(SetTitleOptions(title: widget.config.title!));
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

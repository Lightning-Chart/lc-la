import 'dart:typed_data';

/// The stage at which a chart operation failed.
enum LclaErrorCategory { initialization, license, host, communication, data }

/// Full, actionable details for a chart failure.
class LclaError implements Exception {
  const LclaError({
    required this.category,
    required this.summary,
    required this.details,
    required this.canContinue,
  });

  final LclaErrorCategory category;
  final String summary;
  final String details;
  final bool canContinue;

  @override
  String toString() => '$summary\n\n$details';
}

class LclaLicense {
  const LclaLicense({
    required this.key,
    this.appTitle = 'LightningChart JS Trial',
    this.company = 'LightningChart Ltd.',
    this.theme,
  });

  final String key;
  final String appTitle;
  final String company;
  final LclaTheme? theme;
}

enum LclaTheme {
  darkGold('darkGold'),
  light('light'),
  lightNature('lightNature'),
  turquoiseHexagon('turquoiseHexagon'),
  cyberSpace('cyberSpace');

  const LclaTheme(this.wireValue);

  final String wireValue;
}

class DefaultAxisConfig {
  const DefaultAxisConfig({
    this.id,
    this.title,
    this.opposite,
    this.stackIndex,
    this.parallelIndex,
  });

  final String? id;
  final String? title;
  final bool? opposite;
  final int? stackIndex;
  final int? parallelIndex;
}

class XYChartConfig {
  const XYChartConfig({
    this.title,
    this.containerId,
    this.defaultAxisX,
    this.defaultAxisY,
    this.dataSets,
    this.axes,
    this.series,
    this.animationsEnabled,
  });

  final String? title;
  final String? containerId;
  final DefaultAxisConfig? defaultAxisX;
  final DefaultAxisConfig? defaultAxisY;
  final List<DataSetConfig>? dataSets;
  final List<AxisConfig>? axes;
  final List<SeriesConfig>? series;
  final bool? animationsEnabled;

  XYChartConfig copyWith({
    String? title,
    String? containerId,
    DefaultAxisConfig? defaultAxisX,
    DefaultAxisConfig? defaultAxisY,
    List<DataSetConfig>? dataSets,
    List<AxisConfig>? axes,
    List<SeriesConfig>? series,
    bool? animationsEnabled,
  }) {
    return XYChartConfig(
      title: title ?? this.title,
      containerId: containerId ?? this.containerId,
      defaultAxisX: defaultAxisX ?? this.defaultAxisX,
      defaultAxisY: defaultAxisY ?? this.defaultAxisY,
      dataSets: dataSets ?? this.dataSets,
      axes: axes ?? this.axes,
      series: series ?? this.series,
      animationsEnabled: animationsEnabled ?? this.animationsEnabled,
    );
  }
}

class DataSetConfig {
  const DataSetConfig({
    required this.id,
    required this.columns,
    this.maxSampleCount,
  });

  final String id;
  final List<DataSetColumnConfig> columns;
  final int? maxSampleCount;
}

class DataSetColumnConfig {
  const DataSetColumnConfig({required this.id, this.dataPattern});

  final String id;
  final DataPattern? dataPattern;
}

enum DataPattern {
  progressive('progressive'),
  regressive('regressive'),
  none(null);

  const DataPattern(this.wireValue);

  final String? wireValue;
}

class AxisConfig {
  const AxisConfig({
    required this.id,
    required this.axis,
    this.title,
    this.opposite,
    this.stackIndex,
    this.parallelIndex,
  });

  final String id;
  final AxisTarget axis;
  final String? title;
  final bool? opposite;
  final int? stackIndex;
  final int? parallelIndex;
}

abstract class SeriesConfig {
  const SeriesConfig({required this.id, this.name});

  final String id;
  final String? name;
}

class LineSeriesConfig extends SeriesConfig {
  const LineSeriesConfig({
    required super.id,
    super.name,
    required this.dataSetId,
    required this.x,
    required this.y,
    this.xAxisId,
    this.yAxisId,
    this.color,
  });

  final String dataSetId;
  final String x;
  final String y;
  final String? xAxisId;
  final String? yAxisId;
  final String? color;
}

class ScatterSeriesConfig extends SeriesConfig {
  const ScatterSeriesConfig({
    required super.id,
    super.name,
    required this.dataSetId,
    required this.x,
    required this.y,
    this.xAxisId,
    this.yAxisId,
    this.color,
  });

  final String dataSetId;
  final String x;
  final String y;
  final String? xAxisId;
  final String? yAxisId;
  final String? color;
}

class LineScatterSeriesConfig extends SeriesConfig {
  const LineScatterSeriesConfig({
    required super.id,
    super.name,
    required this.dataSetId,
    required this.x,
    required this.y,
    this.xAxisId,
    this.yAxisId,
    this.color,
  });

  final String dataSetId;
  final String x;
  final String y;
  final String? xAxisId;
  final String? yAxisId;
  final String? color;
}

enum ScrollStrategy {
  scrolling('scrolling'),
  fitting('fitting'),
  expansion('expansion');

  const ScrollStrategy(this.wireValue);

  final String wireValue;
}

enum AxisTarget {
  x('x'),
  y('y');

  const AxisTarget(this.wireValue);

  final String wireValue;
}

enum TickStrategy {
  numeric('numeric'),
  dateTime('dateTime'),
  time('time');

  const TickStrategy(this.wireValue);

  final String wireValue;
}

class SetTitleOptions {
  const SetTitleOptions({required this.title});

  final String title;
}

class SetAxisTitleOptions {
  const SetAxisTitleOptions({this.axis, this.axisId, required this.title});

  final AxisTarget? axis;
  final String? axisId;
  final String title;
}

class SetScrollStrategyOptions {
  const SetScrollStrategyOptions({
    this.axis,
    this.axisId,
    required this.strategy,
  });

  final AxisTarget? axis;
  final String? axisId;
  final ScrollStrategy strategy;
}

class SetAxisIntervalOptions {
  const SetAxisIntervalOptions({
    this.axis,
    this.axisId,
    this.start,
    this.end,
    this.animate,
    this.stopAxisAfter,
  });

  final AxisTarget? axis;
  final String? axisId;
  final double? start;
  final double? end;
  final bool? animate;
  final bool? stopAxisAfter;
}

class SetDefaultAxisIntervalOptions {
  const SetDefaultAxisIntervalOptions({
    this.axis,
    this.axisId,
    this.start,
    this.end,
    this.length,
  });

  final AxisTarget? axis;
  final String? axisId;
  final double? start;
  final double? end;
  final double? length;
}

class SetTickStrategyOptions {
  const SetTickStrategyOptions({
    this.axis,
    this.axisId,
    required this.strategy,
  });

  final AxisTarget? axis;
  final String? axisId;
  final TickStrategy strategy;
}

class SetDataOptions {
  const SetDataOptions({
    required this.dataSetId,
    required this.columns,
    this.maxSampleCount,
  });

  final String dataSetId;
  final Map<String, Float64List> columns;
  final int? maxSampleCount;
}

class AppendDataOptions {
  const AppendDataOptions({
    required this.dataSetId,
    required this.columns,
    this.maxSampleCount,
  });

  final String dataSetId;
  final Map<String, Float64List> columns;
  final int? maxSampleCount;
}

class ClearDataOptions {
  const ClearDataOptions({required this.dataSetId});

  final String dataSetId;
}

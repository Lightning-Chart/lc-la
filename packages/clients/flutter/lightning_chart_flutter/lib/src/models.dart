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

/// Configuration for creating an XY chart.
class XYChartConfig {
  const XYChartConfig({
    this.title,
    this.containerId,
    this.dataSets,
    this.axes,
    this.series,
    this.animationsEnabled,
  });

  final String? title;
  final String? containerId;
  final List<DataSetConfig>? dataSets;

  /// The first X/Y entries configure the default axes.
  /// Omit this list to use the normal default axes.
  /// Additional axes require an ID.
  final List<AxisConfig>? axes;
  final List<SeriesConfig>? series;
  final bool? animationsEnabled;

  XYChartConfig copyWith({
    String? title,
    String? containerId,
    List<DataSetConfig>? dataSets,
    List<AxisConfig>? axes,
    List<SeriesConfig>? series,
    bool? animationsEnabled,
  }) {
    return XYChartConfig(
      title: title ?? this.title,
      containerId: containerId ?? this.containerId,
      dataSets: dataSets ?? this.dataSets,
      axes: axes ?? this.axes,
      series: series ?? this.series,
      animationsEnabled: animationsEnabled ?? this.animationsEnabled,
    );
  }
}

/// Update a chart. Omitted objects and properties remain unchanged.
/// Creation configurations add objects.
/// Update configurations modify existing objects or explicitly remove them.
class UpdateXYChartConfig {
  const UpdateXYChartConfig({
    this.title,
    this.dataSets,
    this.axes,
    this.series,
  });

  final String? title;
  final List<IDataSetConfig>? dataSets;
  final List<IAxisConfig>? axes;
  final List<ISeriesConfig>? series;
}

/// Dataset creation or update configuration.
abstract interface class IDataSetConfig {}

/// Create a dataset with named columns.
/// Columns cannot be changed after creation.
class DataSetConfig implements IDataSetConfig {
  const DataSetConfig({
    required this.id,
    required this.columns,
    this.maxSampleCount,
  });

  final String id;
  final List<DataSetColumnConfig> columns;
  final int? maxSampleCount;
}

/// Update maximum number of samples in dataset or remove a dataset.
class UpdateDataSetConfig implements IDataSetConfig {
  const UpdateDataSetConfig({
    required this.id,
    this.maxSampleCount,
    this.remove,
  });

  final String id;
  final int? maxSampleCount;
  final bool? remove;
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

class AxisIntervalConfig {
  const AxisIntervalConfig({
    this.start,
    this.end,
    this.animate,
    this.stopAxisAfter,
  });

  final double? start;
  final double? end;
  final bool? animate;
  final bool? stopAxisAfter;
}

class AxisDefaultIntervalConfig {
  const AxisDefaultIntervalConfig({this.start, this.end, this.length});

  final double? start;
  final double? end;
  final double? length;
}

/// Axis creation or update configuration.
abstract interface class IAxisConfig {}

/// At chart creation, the first X/Y entries configure the default axes.
/// Additional axes require an ID.
class AxisConfig implements IAxisConfig {
  const AxisConfig({
    this.id,
    required this.axis,
    this.title,
    this.opposite,
    this.stackIndex,
    this.parallelIndex,
    this.interval,
    this.defaultInterval,
    this.tickStrategy,
    this.scrollStrategy,
  });

  final String? id;
  final AxisTarget axis;
  final String? title;
  final bool? opposite;
  final int? stackIndex;
  final int? parallelIndex;
  final AxisIntervalConfig? interval;
  final AxisDefaultIntervalConfig? defaultInterval;
  final TickStrategy? tickStrategy;
  final ScrollStrategy? scrollStrategy;
}

/// Update an axis by ID, or select a default axis using axis.
/// Omitted settings remain unchanged.
class UpdateAxisConfig implements IAxisConfig {
  const UpdateAxisConfig({
    this.id,
    this.axis,
    this.title,
    this.interval,
    this.defaultInterval,
    this.tickStrategy,
    this.scrollStrategy,
    this.remove,
  });

  final String? id;
  final AxisTarget? axis;
  final String? title;
  final AxisIntervalConfig? interval;
  final AxisDefaultIntervalConfig? defaultInterval;
  final TickStrategy? tickStrategy;
  final ScrollStrategy? scrollStrategy;
  final bool? remove;
}

/// Series creation or update configuration.
abstract interface class ISeriesConfig {}

abstract class SeriesConfig implements ISeriesConfig {
  const SeriesConfig({required this.id, this.name});

  final String id;
  final String? name;
}

/// Update an existing series by ID.
/// Omitted settings remain unchanged.
abstract class UpdateSeriesConfig implements ISeriesConfig {
  const UpdateSeriesConfig({required this.id, this.name, this.remove});

  final String id;
  final String? name;
  final bool? remove;
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

class UpdateLineSeriesConfig extends UpdateSeriesConfig {
  const UpdateLineSeriesConfig({
    required super.id,
    super.name,
    super.remove,
    this.dataSetId,
    this.x,
    this.y,
    this.color,
  });

  final String? dataSetId;
  final String? x;
  final String? y;
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

class UpdateScatterSeriesConfig extends UpdateSeriesConfig {
  const UpdateScatterSeriesConfig({
    required super.id,
    super.name,
    super.remove,
    this.dataSetId,
    this.x,
    this.y,
    this.color,
  });

  final String? dataSetId;
  final String? x;
  final String? y;
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

class UpdateLineScatterSeriesConfig extends UpdateSeriesConfig {
  const UpdateLineScatterSeriesConfig({
    required super.id,
    super.name,
    super.remove,
    this.dataSetId,
    this.x,
    this.y,
    this.color,
  });

  final String? dataSetId;
  final String? x;
  final String? y;
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

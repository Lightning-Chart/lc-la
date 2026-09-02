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

class XYChartConfig {
  const XYChartConfig({
    this.title,
    this.containerId,
    this.dataSets,
    this.channels,
    this.animationsEnabled,
  });

  final String? title;
  final String? containerId;
  final List<DataSetConfig>? dataSets;
  final List<ChannelConfig>? channels;
  final bool? animationsEnabled;

  XYChartConfig copyWith({
    String? title,
    String? containerId,
    List<DataSetConfig>? dataSets,
    List<ChannelConfig>? channels,
    bool? animationsEnabled,
  }) {
    return XYChartConfig(
      title: title ?? this.title,
      containerId: containerId ?? this.containerId,
      dataSets: dataSets ?? this.dataSets,
      channels: channels ?? this.channels,
      animationsEnabled: animationsEnabled ?? this.animationsEnabled,
    );
  }
}

class DataSetConfig {
  const DataSetConfig({
    required this.id,
    required this.columns,
    this.xDataPattern,
    this.maxSampleCount,
  });

  final String id;
  final DataPattern? xDataPattern;
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

class ChannelConfig {
  const ChannelConfig({
    required this.id,
    required this.dataSetId,
    required this.column,
    this.name,
    this.color,
    this.type = ChannelType.line,
    this.stackIndex,
  });

  final String id;
  final String dataSetId;
  final String column;
  final String? name;
  final String? color;
  final ChannelType type;
  final int? stackIndex;
}

enum ChannelType {
  line('line'),
  scatter('scatter'),
  lineScatter('line+scatter');

  const ChannelType(this.wireValue);

  final String wireValue;
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

class SetScrollStrategyOptions {
  const SetScrollStrategyOptions({this.axisX, this.axisY});

  final ScrollStrategy? axisX;
  final ScrollStrategy? axisY;
}

class SetAxisIntervalOptions {
  const SetAxisIntervalOptions({
    required this.axis,
    this.start,
    this.end,
    this.stackIndex,
    this.animate,
    this.stopAxisAfter,
  });

  final AxisTarget axis;
  final double? start;
  final double? end;
  final int? stackIndex;
  final bool? animate;
  final bool? stopAxisAfter;
}

class SetDefaultAxisIntervalOptions {
  const SetDefaultAxisIntervalOptions({
    required this.axis,
    this.start,
    this.end,
    this.length,
    this.stackIndex,
  });

  final AxisTarget axis;
  final double? start;
  final double? end;
  final double? length;
  final int? stackIndex;
}

class SetTickStrategyOptions {
  const SetTickStrategyOptions({
    required this.axis,
    required this.strategy,
    this.stackIndex,
  });

  final AxisTarget axis;
  final TickStrategy strategy;
  final int? stackIndex;
}

class SetDataOptions {
  const SetDataOptions({
    required this.dataSetId,
    required this.x,
    required this.columns,
    this.maxSampleCount,
  });

  final String dataSetId;
  final Float64List x;
  final Map<String, Float64List> columns;
  final int? maxSampleCount;
}

class AppendDataOptions {
  const AppendDataOptions({
    required this.dataSetId,
    required this.x,
    required this.columns,
    this.maxSampleCount,
  });

  final String dataSetId;
  final Float64List x;
  final Map<String, Float64List> columns;
  final int? maxSampleCount;
}

class ClearDataOptions {
  const ClearDataOptions({required this.dataSetId});

  final String dataSetId;
}

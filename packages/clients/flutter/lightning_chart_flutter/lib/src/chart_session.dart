import 'dart:async';
import 'dart:typed_data';

import 'bij.dart';
import 'models.dart';

abstract interface class LclaTransport {
  Future<Map<String, Object?>> send(String id, Uint8ListMessage message);
  void sendFireAndForget(Uint8ListMessage message);
  void discardPending();
}

typedef Uint8ListMessage = Uint8List;

class LclaChartSession {
  LclaChartSession(this._transport, this._license)
    : _clientId = 'chart-${++_nextChartId}';

  static var _nextChartId = 0;
  final LclaTransport _transport;
  final LclaLicense _license;
  final String _clientId;
  final List<LclaChart> _charts = [];
  var _nextId = 0;
  var _initialized = false;

  Future<LclaChart> createChart([XYChartConfig? config]) async {
    await _ensureInitialized();

    final id = _nextMessageId();
    final params = <String, Object?>{'type': 'xy'};

    // Include chart and axis settings needed during creation.
    if (config != null) {
      params.addAll(
        _removeNulls({
          'containerId': config.containerId,
          'animationsEnabled': config.animationsEnabled,
          'legendVisible': config.legendVisible,
          'axes': config.axes?.map(_axisToJson).toList(growable: false),
        }),
      );
    }

    final response = await _transport.send(
      id,
      bijEncode([
        BijPart.json('meta', {
          'id': id,
          'category': 'lifecycle',
          'action': 'create',
          'clientId': _clientId,
          'params': params,
        }),
      ]),
    );
    _throwIfError(response);

    final result = response['result']! as Map<String, Object?>;
    final chart = LclaChart._(this, result['chartId']! as String);
    _charts.add(chart);

    // Queue initial title, datasets, and series in order.
    if (config != null) {
      if (config.title != null) {
        chart.update(UpdateXYChartConfig(title: config.title));
      }
      if (config.dataSets != null && config.dataSets!.isNotEmpty) {
        chart.update(UpdateXYChartConfig(dataSets: config.dataSets));
      }
      if (config.series != null && config.series!.isNotEmpty) {
        chart.update(UpdateXYChartConfig(series: config.series));
      }
    }

    return chart;
  }

  Future<void> dispose() async {
    for (final chart in List<LclaChart>.from(_charts)) {
      chart.dispose();
    }
    _charts.clear();

    // Queue context dataset cleanup after the chart-disposal messages.
    _sendFireAndForget([
      BijPart.json('meta', {
        'id': _nextMessageId(),
        'category': 'lifecycle',
        'action': 'dispose',
        'clientId': _clientId,
      }),
    ]);
  }

  void configureDataSets(List<IDataSetConfig> dataSets) {
    _sendFireAndForget([
      BijPart.json('meta', {
        'id': _nextMessageId(),
        'category': 'config',
        'action': 'datasets',
        'clientId': _clientId,
        'params': {
          'datasets': dataSets.map(_dataSetToJson).toList(growable: false),
        },
      }),
    ]);
  }

  void setData(SetDataOptions options) => _sendData(
    'set',
    options.dataSetId,
    options.columns,
    options.maxSampleCount,
  );

  void appendData(AppendDataOptions options) => _sendData(
    'append',
    options.dataSetId,
    options.columns,
    options.maxSampleCount,
  );

  void clearData(ClearDataOptions options) {
    _sendFireAndForget([
      BijPart.json('meta', {
        'id': _nextMessageId(),
        'category': 'data',
        'action': 'clear',
        'clientId': _clientId,
        'dataSetId': options.dataSetId,
      }),
    ]);
  }

  String _nextMessageId() => (++_nextId).toString();

  Future<void> _ensureInitialized() async {
    if (_initialized) {
      return;
    }

    final id = _nextMessageId();
    final initParams = <String, Object?>{'license': _license.key};
    initParams['licenseInformation'] = {
      'appTitle': _license.appTitle,
      'company': _license.company,
    };
    if (_license.theme != null) {
      initParams['theme'] = _license.theme!.wireValue;
    }

    final response = await _transport.send(
      id,
      bijEncode([
        BijPart.json('meta', {
          'id': id,
          'category': 'lifecycle',
          'action': 'init',
          'params': initParams,
        }),
      ]),
    );
    _throwIfError(response);
    _initialized = true;
  }

  void _sendFireAndForget(List<BijPart> parts) {
    _transport.sendFireAndForget(bijEncode(parts));
  }

  void _sendData(
    String action,
    String dataSetId,
    Map<String, Float64List> columns,
    int? maxSampleCount,
  ) {
    final meta = <String, Object?>{
      'id': _nextMessageId(),
      'category': 'data',
      'action': action,
      'clientId': _clientId,
      'dataSetId': dataSetId,
    };
    if (maxSampleCount != null) {
      meta['params'] = {'maxSampleCount': maxSampleCount};
    }
    _sendFireAndForget([
      BijPart.json('meta', meta),
      ...columns.entries.map(
        (entry) => BijPart.float64(entry.key, entry.value),
      ),
    ]);
  }

  void _throwIfError(Map<String, Object?> envelope) {
    if (envelope['type'] == 'error') {
      final details =
          envelope['error']?.toString() ?? 'Unknown chart host error.';
      throw LclaError(
        category: details.toLowerCase().contains('license')
            ? LclaErrorCategory.license
            : LclaErrorCategory.host,
        summary: details.toLowerCase().contains('license')
            ? 'LightningChart rejected the supplied license.'
            : 'LightningChart could not create the chart.',
        details: details,
        canContinue: false,
      );
    }
  }
}

/// Flutter's self-contained chart owner. It exposes all chart and dataset
/// operations because Flutter does not expose a shared LCLA context.
class LclaChart {
  LclaChart._(this._client, this.chartId);

  final LclaChartSession _client;
  final String chartId;
  var _disposed = false;

  /// Update the chart and its datasets, axes, and series.
  /// Omitted objects and properties remain unchanged.
  void update(UpdateXYChartConfig config) {
    _throwIfDisposed();

    final params = _removeNulls({
      'title': config.title,
      'legendVisible': config.legendVisible,
      'dataSets': config.dataSets?.map(_dataSetToJson).toList(growable: false),
      'axes': config.axes?.map(_axisToJson).toList(growable: false),
      'series': config.series?.map(_seriesToJson).toList(growable: false),
    });

    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'update',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': params,
      }),
    ]);
  }

  void setData(SetDataOptions options) {
    _throwIfDisposed();
    _client.setData(options);
  }

  void appendData(AppendDataOptions options) {
    _throwIfDisposed();
    _client.appendData(options);
  }

  void clearData(ClearDataOptions options) {
    _throwIfDisposed();
    _client.clearData(options);
  }

  /// Replaces all matrix data of a heatmap series. [SetMatrixDataOptions.values]
  /// is a flat columns × rows matrix in the data order the series was created
  /// with.
  void setMatrixData(SetMatrixDataOptions options) {
    _throwIfDisposed();
    _sendMatrixData('setMatrix', options.seriesId, null, options.values);
  }

  /// Replaces a rectangular region of a heatmap series' matrix data.
  void invalidateMatrixData(InvalidateMatrixDataOptions options) {
    _throwIfDisposed();
    if (options.values.length != options.columns * options.rows) {
      throw ArgumentError(
        'values must contain columns * rows (${options.columns * options.rows}) items.',
      );
    }
    _sendMatrixData('invalidateMatrix', options.seriesId, {
      'iColumn': options.iColumn,
      'iRow': options.iRow,
      'columns': options.columns,
      'rows': options.rows,
    }, options.values);
  }

  /// Appends samples, or writes samples starting at iSample when supplied.
  /// Every sample must have the same length, matching the series resolution.
  void appendMatrixData(AppendMatrixDataOptions options) {
    _throwIfDisposed();
    final samples = options.samples;
    if (samples.isEmpty) {
      return;
    }

    final sampleLength = samples.first.length;
    final values = Float32List(samples.length * sampleLength);
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].length != sampleLength) {
        throw ArgumentError('All samples must have the same length.');
      }
      values.setAll(i * sampleLength, samples[i]);
    }

    _sendMatrixData('appendMatrix', options.seriesId, {
      'sampleLength': sampleLength,
      if (options.iSample != null) 'iSample': options.iSample,
    }, values);
  }

  /// Clears all matrix data while retaining the heatmap series and its settings.
  void clearMatrixData(ClearMatrixDataOptions options) {
    _throwIfDisposed();
    _sendMatrixData('clearMatrix', options.seriesId, null);
  }

  void _sendMatrixData(
    String action,
    String seriesId,
    Map<String, Object?>? params, [
    Float32List? values,
  ]) {
    final meta = <String, Object?>{
      'id': _client._nextMessageId(),
      'category': 'data',
      'action': action,
      'clientId': _client._clientId,
      'chartId': chartId,
      'seriesId': seriesId,
    };
    if (params != null) {
      meta['params'] = params;
    }
    _client._sendFireAndForget([
      BijPart.json('meta', meta),
      if (values != null) BijPart.float32('values', values),
    ]);
  }

  void dispose() {
    if (_disposed) {
      return;
    }
    _disposed = true;
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'lifecycle',
        'action': 'dispose',
        'clientId': _client._clientId,
        'chartId': chartId,
      }),
    ]);
  }

  void _throwIfDisposed() {
    if (_disposed) {
      throw StateError('LclaChart has been disposed.');
    }
  }
}

Map<String, Object?> _dataSetToJson(IDataSetConfig config) {
  switch (config) {
    case DataSetConfig():
      return _removeNulls({
        'id': config.id,
        'columns': config.columns
            .map(
              (column) => _removeNulls({
                'id': column.id,
                'dataPattern': column.dataPattern?.wireValue,
              }),
            )
            .toList(growable: false),
        'maxSampleCount': config.maxSampleCount,
      });

    case UpdateDataSetConfig():
      return _removeNulls({
        'id': config.id,
        'maxSampleCount': config.maxSampleCount,
        'remove': config.remove,
      });

    default:
      throw UnsupportedError(
        'Serialization is not implemented for ${config.runtimeType}.',
      );
  }
}

Map<String, Object?> _axisToJson(IAxisConfig config) {
  switch (config) {
    case AxisConfig():
      return _removeNulls({
        'id': config.id,
        'axis': config.axis.wireValue,
        'title': config.title,
        'opposite': config.opposite,
        'stackIndex': config.stackIndex,
        'parallelIndex': config.parallelIndex,
        'interval': _axisIntervalToJson(config.interval),
        'defaultInterval': _axisDefaultIntervalToJson(config.defaultInterval),
        'tickStrategy': config.tickStrategy?.wireValue,
        'scrollStrategy': config.scrollStrategy?.wireValue,
      });

    case UpdateAxisConfig():
      return _removeNulls({
        'id': config.id,
        'axis': config.axis?.wireValue,
        'title': config.title,
        'interval': _axisIntervalToJson(config.interval),
        'defaultInterval': _axisDefaultIntervalToJson(config.defaultInterval),
        'tickStrategy': config.tickStrategy?.wireValue,
        'scrollStrategy': config.scrollStrategy?.wireValue,
        'remove': config.remove,
      });

    default:
      throw UnsupportedError(
        'Serialization is not implemented for ${config.runtimeType}.',
      );
  }
}

Map<String, Object?>? _axisIntervalToJson(AxisIntervalConfig? config) {
  if (config == null) return null;

  return _removeNulls({
    'start': config.start,
    'end': config.end,
    'animate': config.animate,
    'stopAxisAfter': config.stopAxisAfter,
  });
}

Map<String, Object?>? _axisDefaultIntervalToJson(
  AxisDefaultIntervalConfig? config,
) {
  if (config == null) return null;

  return _removeNulls({
    'start': config.start,
    'end': config.end,
    'length': config.length,
  });
}

Map<String, Object?> _seriesToJson(ISeriesConfig config) {
  // The configuration class determines the serialized series type.
  switch (config) {
    case LineSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'line',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'xAxisId': config.xAxisId,
        'yAxisId': config.yAxisId,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
      });

    case UpdateLineSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'line',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
        'remove': config.remove,
      });

    case ScatterSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'scatter',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'xAxisId': config.xAxisId,
        'yAxisId': config.yAxisId,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
      });

    case UpdateScatterSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'scatter',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
        'remove': config.remove,
      });

    case LineScatterSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'line+scatter',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'xAxisId': config.xAxisId,
        'yAxisId': config.yAxisId,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
      });

    case UpdateLineScatterSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'line+scatter',
        'name': config.name,
        'dataSetId': config.dataSetId,
        'x': config.x,
        'y': config.y,
        'color': config.color,
        'colorBy': config.colorBy,
        'palette': _paletteToJson(config.palette),
        'remove': config.remove,
      });

    case ScrollingHeatmapSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'scrollingHeatmap',
        'name': config.name,
        'resolution': config.resolution,
        'scrollDimension': config.scrollDimension.wireValue,
        'xAxisId': config.xAxisId,
        'yAxisId': config.yAxisId,
        'start': _pointToJson(config.start),
        'step': _pointToJson(config.step),
        'palette': _paletteToJson(config.palette),
        'dataCleaning': _dataCleaningToJson(config.dataCleaning),
      });

    case UpdateScrollingHeatmapSeriesConfig():
      return _removeNulls({
        'id': config.id,
        'type': 'scrollingHeatmap',
        'name': config.name,
        'start': _pointToJson(config.start),
        'step': _pointToJson(config.step),
        'palette': _paletteToJson(config.palette),
        'dataCleaning': _dataCleaningToJson(config.dataCleaning),
        'remove': config.remove,
      });

    default:
      throw UnsupportedError(
        'Serialization is not implemented for ${config.runtimeType}.',
      );
  }
}

Map<String, Object?> _removeNulls(Map<String, Object?> source) {
  return {
    for (final entry in source.entries)
      if (entry.value != null) entry.key: entry.value,
  };
}

// Convert coordinates to the property names expected by the host.
Map<String, Object?>? _pointToJson(PointConfig? point) =>
    point == null ? null : {'x': point.x, 'y': point.y};

// Convert palette settings to the property names expected by the host.
Map<String, Object?>? _paletteToJson(LUTConfig? palette) {
  if (palette == null) return null;

  return _removeNulls({
    'steps': palette.steps
        .map((step) => {'value': step.value, 'color': step.color})
        .toList(),
    'interpolate': palette.interpolate,
  });
}

// Convert data cleaning settings to the property names expected by the host.
Map<String, Object?>? _dataCleaningToJson(DataCleaningConfig? dataCleaning) =>
    dataCleaning == null
    ? null
    : {'minDataPointCount': dataCleaning.minDataPointCount};

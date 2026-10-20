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
    if (config?.containerId != null) {
      params['containerId'] = config!.containerId;
    }
    final defaultAxisX = config?.defaultAxisX;
    if (defaultAxisX != null) {
      params['defaultAxisX'] = _removeNulls({
        'opposite': defaultAxisX.opposite,
        'name': defaultAxisX.name,
      });
    }
    final defaultAxisY = config?.defaultAxisY;
    if (defaultAxisY != null) {
      params['defaultAxisY'] = _removeNulls({
        'opposite': defaultAxisY.opposite,
        'name': defaultAxisY.name,
      });
    }
    if (config?.animationsEnabled != null) {
      params['animationsEnabled'] = config!.animationsEnabled;
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

    if (config != null) {
      if (config.title != null) {
        chart.setTitle(SetTitleOptions(title: config.title!));
      }
      if (config.dataSets != null && config.dataSets!.isNotEmpty) {
        chart.configureDataSets(config.dataSets!);
      }
      if (config.axes != null && config.axes!.isNotEmpty) {
        chart.configureAxes(config.axes!);
      }
      if (config.series != null && config.series!.isNotEmpty) {
        chart.configureSeries(config.series!);
      }
    }

    return chart;
  }

  Future<void> dispose() async {
    for (final chart in List<LclaChart>.from(_charts)) {
      chart.dispose();
    }
    _charts.clear();
  }

  void configureDataSets(List<DataSetConfig> dataSets) {
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

  void setTitle(SetTitleOptions options) {
    _throwIfDisposed();
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'title',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': {'title': options.title},
      }),
    ]);
  }

  void setScrollStrategy(SetScrollStrategyOptions options) {
    _throwIfDisposed();
    final params = _removeNulls({
      'axis': options.axis?.wireValue,
      'axisId': options.axisId,
      'strategy': options.strategy.wireValue,
    });
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'scrollStrategy',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': params,
      }),
    ]);
  }

  void setAxisInterval(SetAxisIntervalOptions options) {
    _throwIfDisposed();
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'axisInterval',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': _removeNulls({
          'axis': options.axis?.wireValue,
          'start': options.start,
          'end': options.end,
          'axisId': options.axisId,
          'animate': options.animate,
          'stopAxisAfter': options.stopAxisAfter,
        }),
      }),
    ]);
  }

  void setDefaultAxisInterval(SetDefaultAxisIntervalOptions options) {
    _throwIfDisposed();
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'defaultAxisInterval',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': _removeNulls({
          'axis': options.axis?.wireValue,
          'start': options.start,
          'end': options.end,
          'length': options.length,
          'axisId': options.axisId,
        }),
      }),
    ]);
  }

  void setTickStrategy(SetTickStrategyOptions options) {
    _throwIfDisposed();
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'tickStrategy',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': _removeNulls({
          'axis': options.axis?.wireValue,
          'strategy': options.strategy.wireValue,
          'axisId': options.axisId,
        }),
      }),
    ]);
  }

  void configureDataSets(List<DataSetConfig> dataSets) {
    _throwIfDisposed();
    _client.configureDataSets(dataSets);
  }

  void configureAxes(List<AxisConfig> axes) {
    _throwIfDisposed();

    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'axes',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': {'axes': axes.map(_axisToJson).toList(growable: false)},
      }),
    ]);
  }

  void configureSeries(List<SeriesConfig> series) {
    _throwIfDisposed();

    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'series',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': {'series': series.map(_seriesToJson).toList(growable: false)},
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

Map<String, Object?> _dataSetToJson(DataSetConfig dataSet) {
  return _removeNulls({
    'id': dataSet.id,
    'columns': dataSet.columns
        .map(
          (column) => _removeNulls({
            'id': column.id,
            'dataPattern': column.dataPattern?.wireValue,
          }),
        )
        .toList(growable: false),
    'maxSampleCount': dataSet.maxSampleCount,
  });
}

Map<String, Object?> _axisToJson(AxisConfig axis) {
  return _removeNulls({
    'id': axis.id,
    'axis': axis.axis.wireValue,
    'name': axis.name,
    'opposite': axis.opposite,
    'stackIndex': axis.stackIndex,
    'parallelIndex': axis.parallelIndex,
  });
}

Map<String, Object?> _seriesToJson(SeriesConfig series) {
  final value = _removeNulls({'id': series.id, 'name': series.name});

  // Serialize the settings belonging to each series class
  switch (series) {
    case LineScatterSeriesConfig():
      value.addAll(
        _removeNulls({
          'seriesType': 'lineScatter',
          'dataSetId': series.dataSetId,
          'x': series.x,
          'y': series.y,
          'xAxisId': series.xAxisId,
          'yAxisId': series.yAxisId,
          'color': series.color,
          'type': series.type.wireValue,
        }),
      );
      break;

    default:
      throw UnsupportedError(
        'Serialization is not implemented for ${series.runtimeType}.',
      );
  }

  return value;
}

Map<String, Object?> _removeNulls(Map<String, Object?> source) {
  return {
    for (final entry in source.entries)
      if (entry.value != null) entry.key: entry.value,
  };
}

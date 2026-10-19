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
      if (config.channels != null && config.channels!.isNotEmpty) {
        chart.configureChannels(config.channels!);
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
    options.x,
    options.columns,
    options.maxSampleCount,
  );
  void appendData(AppendDataOptions options) => _sendData(
    'append',
    options.dataSetId,
    options.x,
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
    Float64List x,
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
      BijPart.float64('x', x),
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
    final params = <String, Object?>{};
    if (options.axisX != null) {
      params['axisX'] = options.axisX!.wireValue;
    }
    if (options.axisY != null) {
      params['axisY'] = options.axisY!.wireValue;
    }
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
          'axis': options.axis.wireValue,
          'start': options.start,
          'end': options.end,
          'stackIndex': options.stackIndex,
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
          'axis': options.axis.wireValue,
          'start': options.start,
          'end': options.end,
          'length': options.length,
          'stackIndex': options.stackIndex,
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
          'axis': options.axis.wireValue,
          'strategy': options.strategy.wireValue,
          'stackIndex': options.stackIndex,
        }),
      }),
    ]);
  }

  void configureDataSets(List<DataSetConfig> dataSets) {
    _throwIfDisposed();
    _client.configureDataSets(dataSets);
  }

  void configureChannels(List<ChannelConfig> channels) {
    _throwIfDisposed();
    _client._sendFireAndForget([
      BijPart.json('meta', {
        'id': _client._nextMessageId(),
        'category': 'config',
        'action': 'channels',
        'clientId': _client._clientId,
        'chartId': chartId,
        'params': {
          'channels': channels.map(_channelToJson).toList(growable: false),
        },
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

  /// Appends samples (columns or rows, along the scroll dimension) to a
  /// scrolling heatmap series. Every sample must have the same length,
  /// matching the series resolution.
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
    }, values);
  }

  void _sendMatrixData(
    String action,
    String seriesId,
    Map<String, Object?>? params,
    Float32List values,
  ) {
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
      BijPart.float32('values', values),
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

Map<String, Object?> _dataSetToJson(DataSetConfig dataSet) {
  return _removeNulls({
    'id': dataSet.id,
    'xDataPattern': dataSet.xDataPattern?.wireValue,
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

Map<String, Object?> _channelToJson(ChannelConfig channel) {
  return _removeNulls({
    'id': channel.id,
    'dataSetId': channel.dataSetId,
    'column': channel.column,
    'name': channel.name,
    'color': channel.color,
    'type': channel.type.wireValue,
    'stackIndex': channel.stackIndex,
  });
}

Map<String, Object?> _removeNulls(Map<String, Object?> source) {
  return {
    for (final entry in source.entries)
      if (entry.value != null) entry.key: entry.value,
  };
}

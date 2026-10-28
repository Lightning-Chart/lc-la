import 'package:flutter_test/flutter_test.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';
import 'package:lightning_chart_flutter/src/chart_session.dart';

class _MockTransport implements LclaTransport {
  final sentMessages = <Map<String, Object?>>[];
  final fireAndForgetMessages = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>> send(String id, Uint8ListMessage message) async {
    final meta = bijDecode(message)['meta']! as Map<String, Object?>;
    sentMessages.add(meta);

    return {
      'id': id,
      'type': 'response',
      if (meta['action'] == 'create') 'result': {'chartId': 'chart-1'},
    };
  }

  @override
  void sendFireAndForget(Uint8ListMessage message) {
    final meta = bijDecode(message)['meta']! as Map<String, Object?>;
    fireAndForgetMessages.add(meta);
  }

  @override
  void discardPending() {}
}

void main() {
  test('creates axes before queuing title, datasets, and series', () async {
    final transport = _MockTransport();
    final session = LclaChartSession(
      transport,
      const LclaLicense(key: 'test-license'),
    );

    final chart = await session.createChart(
      const XYChartConfig(
        title: 'Chart title',
        animationsEnabled: false,
        dataSets: [
          DataSetConfig(
            id: 'dataset',
            columns: [
              DataSetColumnConfig(
                id: 'x',
                dataPattern: DataPattern.progressive,
              ),
              DataSetColumnConfig(id: 'y'),
            ],
          ),
        ],
        axes: [
          AxisConfig(
            axis: AxisTarget.y,
            opposite: true,
            interval: AxisIntervalConfig(
              start: 0,
              end: 100,
              stopAxisAfter: false,
            ),
          ),
        ],
        series: [
          LineSeriesConfig(
            id: 'series-1',
            dataSetId: 'dataset',
            x: 'x',
            y: 'y',
          ),
        ],
      ),
    );

    expect(chart.chartId, 'chart-1');
    expect(transport.sentMessages, hasLength(2));

    final meta = transport.sentMessages.last;
    expect(meta['category'], 'lifecycle');
    expect(meta['action'], 'create');

    final params = meta['params']! as Map<String, Object?>;
    expect(params.containsKey('title'), isFalse);
    expect(params.containsKey('dataSets'), isFalse);
    expect(params.containsKey('series'), isFalse);
    expect(params['animationsEnabled'], false);
    expect(params['axes'], [
      {
        'axis': 'y',
        'opposite': true,
        'interval': {'start': 0, 'end': 100, 'stopAxisAfter': false},
      },
    ]);

    // Title, datasets, and series are queued in that order.
    final updates = transport.fireAndForgetMessages;
    expect(updates, hasLength(3));

    for (final update in updates) {
      expect(update['category'], 'config');
      expect(update['action'], 'update');
      expect(update['chartId'], chart.chartId);
    }

    expect(updates[0]['params'], {'title': 'Chart title'});
    expect(updates[1]['params'], {
      'dataSets': [
        {
          'id': 'dataset',
          'columns': [
            {'id': 'x', 'dataPattern': 'progressive'},
            {'id': 'y'},
          ],
        },
      ],
    });
    expect(updates[2]['params'], {
      'series': [
        {
          'id': 'series-1',
          'type': 'line',
          'dataSetId': 'dataset',
          'x': 'x',
          'y': 'y',
        },
      ],
    });
  });

  test('serializes partial updates and dataset removal requests', () async {
    final transport = _MockTransport();
    final session = LclaChartSession(
      transport,
      const LclaLicense(key: 'test-license'),
    );

    final chart = await session.createChart(
      const XYChartConfig(
        dataSets: [
          DataSetConfig(
            id: 'old-data',
            columns: [
              DataSetColumnConfig(id: 'x'),
              DataSetColumnConfig(id: 'y'),
            ],
          ),
        ],
        series: [
          LineSeriesConfig(
            id: 'series-1',
            name: 'Series name',
            dataSetId: 'old-data',
            x: 'x',
            y: 'y',
          ),
        ],
      ),
    );

    chart.update(
      const UpdateXYChartConfig(
        dataSets: [
          DataSetConfig(
            id: 'new-data',
            columns: [
              DataSetColumnConfig(id: 'x'),
              DataSetColumnConfig(id: 'y'),
            ],
          ),
          UpdateDataSetConfig(id: 'old-data', remove: true),
        ],
        axes: [
          UpdateAxisConfig(
            axis: AxisTarget.y,
            title: '',
            interval: AxisIntervalConfig(end: 100, stopAxisAfter: false),
          ),
        ],
        series: [
          UpdateLineSeriesConfig(
            id: 'series-1',
            dataSetId: 'new-data',
            color: '#FFD400',
          ),
        ],
      ),
    );

    // Two initial configuration messages, followed by the explicit update.
    expect(transport.fireAndForgetMessages, hasLength(3));

    final meta = transport.fireAndForgetMessages.last;
    expect(meta['category'], 'config');
    expect(meta['action'], 'update');
    expect(meta['chartId'], chart.chartId);

    expect(meta['params'], {
      'dataSets': [
        {
          'id': 'new-data',
          'columns': [
            {'id': 'x'},
            {'id': 'y'},
          ],
        },
        {'id': 'old-data', 'remove': true},
      ],
      'axes': [
        {
          'axis': 'y',
          'title': '',
          'interval': {'end': 100, 'stopAxisAfter': false},
        },
      ],
      'series': [
        {
          'id': 'series-1',
          'type': 'line',
          'dataSetId': 'new-data',
          'color': '#FFD400',
        },
      ],
    });
  });
}

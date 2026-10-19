import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';
import 'package:lightning_chart_flutter/src/chart_session.dart';

class _FakeTransport implements LclaTransport {
  final sent = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>> send(String id, Uint8List message) async => {
    'id': id,
    'type': 'response',
    'result': {'chartId': 'chart-1'},
  };

  @override
  void sendFireAndForget(Uint8List message) => sent.add(bijDecode(message));

  @override
  void discardPending() {}
}

Future<(LclaChart, _FakeTransport)> _createChart() async {
  final transport = _FakeTransport();
  final session = LclaChartSession(
    transport,
    const LclaLicense(key: 'test-license'),
  );
  return (await session.createChart(), transport);
}

void main() {
  test('setMatrixData sends flat float32 values by series id', () async {
    final (chart, transport) = await _createChart();
    final values = Float32List.fromList([1, 2, 3, 4, 5, 6]);

    chart.setMatrixData(
      SetMatrixDataOptions(seriesId: 'heatmap', values: values),
    );

    final message = transport.sent.last;
    final meta = message['meta']! as Map<String, Object?>;
    expect(meta['category'], 'data');
    expect(meta['action'], 'setMatrix');
    expect(meta['chartId'], 'chart-1');
    expect(meta['seriesId'], 'heatmap');
    expect(message['values'], values);
  });

  test('invalidateMatrixData sends region and validates size', () async {
    final (chart, transport) = await _createChart();

    chart.invalidateMatrixData(
      InvalidateMatrixDataOptions(
        seriesId: 'heatmap',
        iColumn: 10,
        iRow: 2,
        columns: 2,
        rows: 3,
        values: Float32List(6),
      ),
    );

    final meta = transport.sent.last['meta']! as Map<String, Object?>;
    expect(meta['action'], 'invalidateMatrix');
    expect(meta['params'], {'iColumn': 10, 'iRow': 2, 'columns': 2, 'rows': 3});

    expect(
      () => chart.invalidateMatrixData(
        InvalidateMatrixDataOptions(
          seriesId: 'heatmap',
          iColumn: 0,
          iRow: 0,
          columns: 2,
          rows: 3,
          values: Float32List(5),
        ),
      ),
      throwsArgumentError,
    );
  });

  test('appendMatrixData flattens samples into one part', () async {
    final (chart, transport) = await _createChart();

    chart.appendMatrixData(
      AppendMatrixDataOptions(
        seriesId: 'spectrogram',
        samples: [
          Float32List.fromList([1, 2, 3]),
          Float32List.fromList([4, 5, 6]),
        ],
      ),
    );

    final message = transport.sent.last;
    final meta = message['meta']! as Map<String, Object?>;
    expect(meta['action'], 'appendMatrix');
    expect(meta['params'], {'sampleLength': 3});
    expect(message['values'], Float32List.fromList([1, 2, 3, 4, 5, 6]));

    expect(
      () => chart.appendMatrixData(
        AppendMatrixDataOptions(
          seriesId: 'spectrogram',
          samples: [
            Float32List.fromList([1, 2, 3]),
            Float32List.fromList([4, 5]),
          ],
        ),
      ),
      throwsArgumentError,
    );
  });
}

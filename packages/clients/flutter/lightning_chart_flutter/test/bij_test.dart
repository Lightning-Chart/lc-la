import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lightning_chart_flutter/lightning_chart_flutter.dart';

void main() {
  test('uses trial license information by default', () {
    const license = LclaLicense(key: 'test-license');

    expect(license.appTitle, 'LightningChart JS Trial');
    expect(license.company, 'LightningChart Ltd.');
  });

  test('round trips JSON-only BIJ messages', () {
    final buffer = bijEncode([
      BijPart.json('meta', {
        'id': '1',
        'category': 'lifecycle',
        'action': 'create',
      }),
      BijPart.json('params', {'type': 'xy'}),
    ]);

    final decoded = bijDecode(buffer);
    final meta = decoded['meta']! as Map<String, Object?>;
    final params = decoded['params']! as Map<String, Object?>;

    expect(meta['category'], 'lifecycle');
    expect(meta['action'], 'create');
    expect(params['type'], 'xy');
  });

  test('round trips Float64 arrays', () {
    final x = Float64List.fromList([1, 2, 3, 4, 5]);
    final y = Float64List.fromList([10, 20, 30, 40, 50]);

    final buffer = bijEncode([
      BijPart.json('meta', {'id': '1', 'category': 'data'}),
      BijPart.float64('x', x),
      BijPart.float64('y', y),
    ]);

    final decoded = bijDecode(buffer);

    expect(decoded['x'], x);
    expect(decoded['y'], y);
  });

  test('uses the same aligned metadata structure as host and C# clients', () {
    final buffer = bijEncode([
      BijPart.json('meta', {'id': '1'}),
      BijPart.float64('x', Float64List.fromList([1])),
    ]);

    final view = ByteData.sublistView(buffer);
    final metadataLength = view.getUint16(0, Endian.little);

    expect(metadataLength, greaterThan(0));
    for (var i = 2; i < 8; i++) {
      expect(buffer[i], 0);
    }

    final metadataJson = utf8.decode(buffer.sublist(8, 8 + metadataLength));
    final metadata = jsonDecode(metadataJson);
    expect(metadata, isA<List<Object?>>());
  });
}

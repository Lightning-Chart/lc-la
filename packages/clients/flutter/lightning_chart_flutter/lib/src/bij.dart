import 'dart:convert';
import 'dart:typed_data';

enum BijValueType {
  json('json'),
  float32('float32'),
  float64('float64');

  const BijValueType(this.wireValue);

  final String wireValue;
}

class BijPart {
  const BijPart._(this.key, this.value, this.type);

  factory BijPart.json(String key, Object? value) =>
      BijPart._(key, value, BijValueType.json);

  factory BijPart.float32(String key, Float32List value) =>
      BijPart._(key, value, BijValueType.float32);

  factory BijPart.float64(String key, Float64List value) =>
      BijPart._(key, value, BijValueType.float64);

  final String key;
  final Object? value;
  final BijValueType type;
}

int _align8(int n) => (n + 7) & ~7;

Uint8List bijEncode(List<BijPart> parts) {
  final encodedParts = <Uint8List>[];
  final metadata = <Map<String, Object?>>[];
  var dataOffset = 0;

  for (final part in parts) {
    final bytes = switch (part.type) {
      BijValueType.json => Uint8List.fromList(
        utf8.encode(jsonEncode(part.value)),
      ),
      BijValueType.float32 => _float32Bytes(part.value! as Float32List),
      BijValueType.float64 => _float64Bytes(part.value! as Float64List),
    };

    encodedParts.add(bytes);
    metadata.add({
      'key': part.key,
      'start': dataOffset,
      'length': bytes.length,
      'type': part.type.wireValue,
    });
    dataOffset += _align8(bytes.length);
  }

  final metadataBytes = Uint8List.fromList(utf8.encode(jsonEncode(metadata)));
  if (metadataBytes.length > 0xffff) {
    throw ArgumentError.value(
      metadataBytes.length,
      'metadata length',
      'BIJ metadata length must fit in UInt16.',
    );
  }

  const metadataPrefixByteLength = 8;
  final totalByteLength =
      metadataPrefixByteLength +
      _align8(metadataBytes.length) +
      encodedParts.fold<int>(0, (sum, bytes) => sum + _align8(bytes.length));

  final buffer = Uint8List(totalByteLength);
  final view = ByteData.sublistView(buffer);
  view.setUint16(0, metadataBytes.length, Endian.little);
  buffer.setRange(
    metadataPrefixByteLength,
    metadataPrefixByteLength + metadataBytes.length,
    metadataBytes,
  );

  var writeOffset = metadataPrefixByteLength + _align8(metadataBytes.length);
  for (final bytes in encodedParts) {
    buffer.setRange(writeOffset, writeOffset + bytes.length, bytes);
    writeOffset += _align8(bytes.length);
  }

  return buffer;
}

Map<String, Object?> bijDecode(Uint8List buffer) {
  final view = ByteData.sublistView(buffer);
  final metadataByteLength = view.getUint16(0, Endian.little);
  final metadataJson = utf8.decode(buffer.sublist(8, 8 + metadataByteLength));
  final metadata = (jsonDecode(metadataJson) as List<Object?>)
      .map((item) => Map<String, Object?>.from(item! as Map))
      .toList(growable: false);
  final dataStart = 8 + _align8(metadataByteLength);
  final result = <String, Object?>{};

  for (final part in metadata) {
    final key = part['key']! as String;
    final start = part['start']! as int;
    final length = part['length']! as int;
    final type = part['type']! as String;
    final firstByte = dataStart + start;

    switch (type) {
      case 'json':
        result[key] = jsonDecode(
          utf8.decode(buffer.sublist(firstByte, firstByte + length)),
        );
        break;
      case 'float32':
        result[key] = Float32List.view(
          buffer.buffer,
          buffer.offsetInBytes + firstByte,
          length ~/ 4,
        );
        break;
      case 'float64':
        result[key] = Float64List.view(
          buffer.buffer,
          buffer.offsetInBytes + firstByte,
          length ~/ 8,
        );
        break;
      default:
        throw FormatException('Unknown BIJ part type: $type');
    }
  }

  return result;
}

Uint8List _float32Bytes(Float32List values) {
  return values.buffer.asUint8List(values.offsetInBytes, values.lengthInBytes);
}

Uint8List _float64Bytes(Float64List values) {
  return values.buffer.asUint8List(values.offsetInBytes, values.lengthInBytes);
}

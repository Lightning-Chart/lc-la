import 'dart:typed_data';

import 'chart_session.dart';

class LclaWebViewBridge implements LclaTransport {
  Uri get uri => throw UnsupportedError(
    'LclaWebViewBridge is only available on native Flutter targets.',
  );

  Future<void> get ready => throw UnsupportedError(
    'LclaWebViewBridge is only available on native Flutter targets.',
  );

  static Future<LclaWebViewBridge> start({
    String host = '127.0.0.1',
    String hostAssetPath =
        'packages/lightning_chart_flutter/assets/lcla-host.js',
  }) async {
    throw UnsupportedError(
      'LclaWebViewBridge is only available on native Flutter targets.',
    );
  }

  @override
  Future<Map<String, Object?>> send(String id, Uint8List message) {
    throw UnsupportedError(
      'LclaWebViewBridge is only available on native Flutter targets.',
    );
  }

  @override
  void sendFireAndForget(Uint8List message) {
    throw UnsupportedError(
      'LclaWebViewBridge is only available on native Flutter targets.',
    );
  }

  @override
  void discardPending() {}

  Future<void> dispose() async {}
}

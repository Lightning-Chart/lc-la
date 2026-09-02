import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

import 'bij.dart';
import 'chart_session.dart';

class LclaWebViewBridge implements LclaTransport {
  LclaWebViewBridge._(this._server, this.uri, this._hostScript);

  static const defaultHostAssetPath =
      'packages/lightning_chart_flutter/assets/lcla-host.js';

  final HttpServer _server;
  final Uri uri;
  final String _hostScript;
  final _ready = Completer<void>();
  final _pending = <String, Completer<Map<String, Object?>>>{};
  final _subscriptions = <StreamSubscription<dynamic>>[];
  WebSocket? _socket;

  static Future<LclaWebViewBridge> start({
    String host = '127.0.0.1',
    String hostAssetPath = defaultHostAssetPath,
  }) async {
    final hostScript = await rootBundle.loadString(hostAssetPath);
    final server = await HttpServer.bind(host, 0);
    final bridge = LclaWebViewBridge._(
      server,
      Uri.parse('http://$host:${server.port}/'),
      hostScript,
    );
    bridge._subscriptions.add(server.listen(bridge._handleRequest));
    return bridge;
  }

  Future<void> get ready => _ready.future;

  @override
  Future<Map<String, Object?>> send(String id, Uint8ListMessage message) async {
    await ready;
    final completer = Completer<Map<String, Object?>>();
    _pending[id] = completer;
    _socket!.add(message);
    return completer.future;
  }

  @override
  void sendFireAndForget(Uint8ListMessage message) {
    final socket = _socket;
    if (socket == null) {
      throw StateError('LCLA WebView bridge is not connected.');
    }
    socket.add(message);
  }

  @override
  void discardPending() {
    for (final completer in _pending.values) {
      if (!completer.isCompleted) {
        completer.completeError(
          StateError('Pending LCLA response was discarded.'),
        );
      }
    }
    _pending.clear();
  }

  Future<void> dispose() async {
    discardPending();
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    await _socket?.close();
    await _server.close(force: true);
  }

  Future<void> _handleRequest(HttpRequest request) async {
    if (request.uri.path == '/lcla-ws' &&
        WebSocketTransformer.isUpgradeRequest(request)) {
      final socket = await WebSocketTransformer.upgrade(request);
      _socket = socket;
      socket.listen(
        _handleSocketMessage,
        onDone: () {
          if (identical(_socket, socket)) {
            _socket = null;
          }
        },
        onError: (Object error, StackTrace stackTrace) {
          for (final completer in _pending.values) {
            if (!completer.isCompleted) {
              completer.completeError(error, stackTrace);
            }
          }
          _pending.clear();
        },
      );
      if (!_ready.isCompleted) {
        _ready.complete();
      }
      return;
    }

    if (request.uri.path == '/') {
      await _writeText(
        request.response,
        _html(),
        contentType: ContentType.html,
      );
      return;
    }

    if (request.uri.path == '/lcla-host.js') {
      await _writeText(
        request.response,
        _hostScript,
        contentType: ContentType('application', 'javascript', charset: 'utf-8'),
      );
      return;
    }

    request.response.statusCode = HttpStatus.notFound;
    await request.response.close();
  }

  void _handleSocketMessage(dynamic message) {
    if (message is String) {
      return;
    }

    final bytes = message is Uint8List
        ? message
        : Uint8List.fromList((message as List<int>));
    final decoded = bijDecode(bytes);
    final meta = Map<String, Object?>.from(decoded['meta']! as Map);
    final id = meta['id']?.toString();
    if (id == null) {
      return;
    }

    final completer = _pending.remove(id);
    if (completer != null && !completer.isCompleted) {
      completer.complete(meta);
    }
  }

  Future<void> _writeText(
    HttpResponse response,
    String text, {
    required ContentType contentType,
  }) async {
    response.headers.contentType = contentType;
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    response.add(utf8.encode(text));
    await response.close();
  }

  String _html() {
    final wsUri = 'ws://${uri.host}:${uri.port}/lcla-ws';
    return '''
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <style>
    html, body, #lcla-root {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #000;
    }
  </style>
</head>
<body>
  <div id="lcla-root"></div>
  <script src="/lcla-host.js"></script>
  <script>
    (() => {
      const socket = new WebSocket('$wsUri');
      socket.binaryType = 'arraybuffer';
      socket.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const response = window.__lcla.processMessage(event.data);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(response);
        }
      };
    })();
  </script>
</body>
</html>
''';
  }
}

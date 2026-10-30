import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClientId,
  getApiBase,
  getWebSocketUrl,
  mediaErrorMessage,
  webRtcErrorMessage,
} from '../src/client/utils.js';

test('uses the browser LAN hostname for the default WebSocket endpoint', () => {
  const url = getWebSocketUrl({ protocol: 'http:', hostname: '192.168.1.10' });
  assert.equal(url, 'ws://192.168.1.10:3001/ws');
  assert.equal(getApiBase(url), 'http://192.168.1.10:3001');
});

test('uses secure WebSocket on HTTPS and honors a configured endpoint', () => {
  assert.equal(
    getWebSocketUrl({ protocol: 'https:', hostname: 'game.example' }),
    'wss://game.example:3001/ws',
  );
  assert.equal(
    getWebSocketUrl({ override: 'wss://socket.example/custom/ws', protocol: 'http:', hostname: 'ignored' }),
    'wss://socket.example/custom/ws',
  );
});

test('creates a UUID v4 when randomUUID is unavailable in an insecure LAN context', () => {
  const fallbackCrypto = {
    getRandomValues(bytes) {
      bytes.fill(0);
      return bytes;
    },
  };
  assert.equal(createClientId(fallbackCrypto), '00000000-0000-4000-8000-000000000000');
});

test('distinguishes camera permission denial from missing media devices', () => {
  assert.match(mediaErrorMessage({ name: 'NotAllowedError' }, 'camera'), /chưa cấp quyền camera/);
  assert.match(mediaErrorMessage({ name: 'NotAllowedError' }, 'microphone'), /chưa cấp quyền microphone/);
  assert.match(mediaErrorMessage({ name: 'NotFoundError' }, 'camera'), /Không tìm thấy camera/);
  assert.match(mediaErrorMessage({ name: 'NotReadableError' }, 'microphone'), /microphone đang được ứng dụng khác sử dụng/);
});

test('reports WebRTC transport failures separately from media permission failures', () => {
  assert.match(webRtcErrorMessage(new Error('ICE failed')), /Kết nối WebRTC thất bại: ICE failed/);
});

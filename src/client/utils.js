export function getWebSocketUrl({ override, protocol, hostname }) {
  if (override) return override;
  const scheme = protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${hostname}:3001/ws`;
}

export function getApiBase(webSocketUrl) {
  return webSocketUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

// Browser HTTP and WebSocket share one origin (Vite proxy or the Node host).
export function getAppEndpoints(location, override) {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const webSocketUrl = override || `${scheme}//${location.host}/ws`;
  return { webSocketUrl, apiBase: getApiBase(webSocketUrl) };
}

export function createClientId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function mediaErrorMessage(error, device = 'camera hoặc microphone') {
  const name = error?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return `Bạn chưa cấp quyền ${device}. Hãy cho phép thiết bị này trong cài đặt trình duyệt rồi thử lại.`;
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return `Không tìm thấy ${device} khả dụng trên thiết bị.`;
  if (name === 'NotReadableError' || name === 'TrackStartError') return `${device} đang được ứng dụng khác sử dụng.`;
  if (name === 'OverconstrainedError') return `${device} không đáp ứng được cấu hình yêu cầu.`;
  return `Không thể bật ${device}${error?.message ? `: ${error.message}` : '.'}`;
}

export function webRtcErrorMessage(error) {
  return `Kết nối WebRTC thất bại${error?.message ? `: ${error.message}` : '.'} Hãy thử lại hoặc chuyển sang cùng mạng ổn định hơn.`;
}

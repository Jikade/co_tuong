export function getWebSocketUrl({ override, protocol, hostname }) {
  if (override) return override;
  const scheme = protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${hostname}:3001/ws`;
}

export function getApiBase(webSocketUrl) {
  return webSocketUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
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

export function mediaErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Bạn đã từ chối quyền camera hoặc microphone. Hãy cho phép quyền này trong cài đặt Safari của iPhone rồi thử lại.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'Không tìm thấy camera hoặc microphone khả dụng trên thiết bị.';
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'Camera hoặc microphone đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
  }
  if (error?.name === 'OverconstrainedError') {
    return 'Camera hoặc microphone không đáp ứng được cấu hình yêu cầu.';
  }
  return `Không thể bật camera hoặc microphone${error?.message ? `: ${error.message}` : '.'}`;
}

export function webRtcErrorMessage(error) {
  return `Kết nối WebRTC thất bại${error?.message ? `: ${error.message}` : '.'} Hãy thử lại hoặc chuyển sang cùng mạng ổn định hơn.`;
}

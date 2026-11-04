import { ApiError } from '../errors.js';

export const SESSION_COOKIE = 'cotuong_session';
export function sessionToken(request) {
  const match = (request.headers.cookie ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1) ?? null;
}
export async function readJson(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16384) throw new ApiError(413, 'Nội dung yêu cầu quá lớn.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new ApiError(400, 'JSON không hợp lệ.'); }
}
export function sameOrigin(request) {
  if (!request.headers.origin) return true;
  const scheme = request.socket.encrypted ? 'https:' : 'http:';
  return request.headers.origin === `${scheme}//${request.headers.host}`;
}

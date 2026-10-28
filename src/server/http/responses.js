export const JSON_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...JSON_HEADERS });
  response.end(JSON.stringify(payload));
}

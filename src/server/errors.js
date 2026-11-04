export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function httpError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status : 500;
  return { status, body: { error: status === 500 ? 'Không thể xử lý yêu cầu.' : error.message } };
}

export function socketError(message, requestId) {
  return { type: 'error', message, ...(typeof requestId === 'string' ? { requestId } : {}) };
}

export function socketActionError(error, requestId) {
  const message = error?.code === 'PERSISTENCE_ERROR'
    ? 'Không thể lưu trạng thái trận. Hãy thử lại.'
    : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  return socketError(message, requestId);
}

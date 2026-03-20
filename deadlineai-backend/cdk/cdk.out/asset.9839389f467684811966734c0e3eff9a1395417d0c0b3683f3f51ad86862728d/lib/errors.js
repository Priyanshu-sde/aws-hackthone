export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

export function badRequest(message) {
  return response(400, { error: { code: 'BAD_REQUEST', message } });
}

export function unauthorized(message = 'Unauthorized') {
  return response(401, { error: { code: 'UNAUTHORIZED', message } });
}

export function notFound(message = 'Not found') {
  return response(404, { error: { code: 'NOT_FOUND', message } });
}

export function serverError(message = 'Internal server error') {
  return response(500, { error: { code: 'INTERNAL_ERROR', message } });
}

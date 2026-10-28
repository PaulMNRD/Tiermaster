import { HttpException, HttpStatus } from '@nestjs/common';

/** Throws-ready HTTP error with a stable machine-readable `code` (see ApiErrorSchema in shared). */
export function apiError(status: HttpStatus, code: string, message?: string): HttpException {
  return new HttpException({ statusCode: status, code, message: message ?? code }, status);
}

export const unauthorized = () => apiError(HttpStatus.UNAUTHORIZED, 'unauthorized');
export const forbidden = (code = 'forbidden') => apiError(HttpStatus.FORBIDDEN, code);
export const notFound = (code = 'not_found') => apiError(HttpStatus.NOT_FOUND, code);
export const conflict = (code: string) => apiError(HttpStatus.CONFLICT, code);

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  410: 'gone',
  413: 'file_too_large',
  415: 'unsupported_type',
  429: 'rate_limited',
};

/** Every error leaves the API as `{ statusCode, code, message }` (ApiErrorSchema), including framework errors. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      res.status(500).json({ statusCode: 500, code: 'internal_error', message: 'internal_error' });
      return;
    }
    const status = exception.getStatus();
    const body = exception.getResponse();
    const code =
      typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : (DEFAULT_CODES[status] ?? (status >= 500 ? 'internal_error' : 'error'));
    const message = typeof body === 'object' && body !== null && 'message' in body ? String((body as { message: unknown }).message) : code;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception.stack);
    res.status(status).json({ statusCode: status, code, message });
  }
}

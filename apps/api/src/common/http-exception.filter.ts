import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/** Uniform error body: { statusCode, code, message, details? }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const isValidation = typeof body === 'object' && Array.isArray((body as { message?: unknown }).message);
      const payload =
        typeof body === 'string'
          ? { statusCode: status, code: 'HTTP_ERROR', message: body }
          : { statusCode: status, code: isValidation ? 'VALIDATION_ERROR' : 'HTTP_ERROR', ...(body as object) };
      res.status(status).json(payload);
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    });
  }
}

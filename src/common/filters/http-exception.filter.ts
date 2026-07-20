import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { AppLogger } from '../logger/app-logger';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLogger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof AppError) {
      if (!exception.isOperational || exception.statusCode >= 500) {
        this.logger.error(exception.message, exception.stack);
      }
      return res.status(exception.statusCode).json({
        error: true,
        code: exception.code,
        message: exception.message,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      return res.status(status).json({
        error: true,
        code: status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
    }

    const err = exception as Error;
    this.logger.error(err?.message || String(exception), err?.stack, {
      path: req.originalUrl,
    });

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: true,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
      ...(process.env.NODE_ENV !== 'production'
        ? { details: err?.message }
        : {}),
    });
  }
}

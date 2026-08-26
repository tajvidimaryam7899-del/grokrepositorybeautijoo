import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) || randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) || message;
        error = (b.error as string) || error;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      if ((exception as { code?: string }).code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'منبع تکراری است';
        error = 'Conflict';
      } else if ((exception as { code?: string }).code === 'P2004') {
        status = HttpStatus.CONFLICT;
        message = 'تداخل زمانی — این بازه قبلاً رزرو شده است';
        error = 'Conflict';
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

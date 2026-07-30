import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Capture 5xx errors or non-HttpExceptions (unexpected uncaught errors) in Sentry
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR || !(exception instanceof HttpException)) {
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('environment', process.env.NODE_ENV ?? 'development');

          // Tag with request id if available
          const requestId =
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-correlation-id'] as string) ||
            (request as any).id ||
            (request as any).requestId;

          if (requestId) {
            scope.setTag('request_id', requestId);
          }

          scope.setExtra('url', request.url);
          scope.setExtra('method', request.method);

          if ((request as any).isce_auth) {
            const user = (request as any).isce_auth;
            scope.setUser({
              id: user.id,
              email: user.email,
            });
          }

          Sentry.captureException(exception);
        });
      }
    }

    if (response.headersSent) {
      return;
    }

    const resBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(
      typeof resBody === 'object'
        ? resBody
        : { statusCode: status, message: resBody },
    );
  }
}

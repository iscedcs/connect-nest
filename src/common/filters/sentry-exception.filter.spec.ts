import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { SentryExceptionFilter } from './sentry-exception.filter';

jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn((callback) => callback(mockScope)),
  captureException: jest.fn(),
  SentryExceptionCaptured: () => (target: any, propertyKey: any, descriptor: any) => descriptor,
}));

const mockScope = {
  setTag: jest.fn(),
  setExtra: jest.fn(),
  setUser: jest.fn(),
};

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SENTRY_DSN: 'https://test@sentry.io/12345', NODE_ENV: 'test' };

    filter = new SentryExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
    };

    mockRequest = {
      url: '/api/test',
      method: 'POST',
      headers: {
        'x-request-id': 'req-123',
      },
      isce_auth: {
        id: 'user-456',
        email: 'user@example.com',
      },
    };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should capture uncaught non-HttpExceptions in Sentry and return 500', () => {
    const error = new Error('Database error');

    filter.catch(error, mockArgumentsHost);

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(mockScope.setTag).toHaveBeenCalledWith('environment', 'test');
    expect(mockScope.setTag).toHaveBeenCalledWith('request_id', 'req-123');
    expect(mockScope.setExtra).toHaveBeenCalledWith('url', '/api/test');
    expect(mockScope.setExtra).toHaveBeenCalledWith('method', 'POST');
    expect(mockScope.setUser).toHaveBeenCalledWith({
      id: 'user-456',
      email: 'user@example.com',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  it('should capture 500 InternalServerError HttpException in Sentry', () => {
    const httpError = new HttpException('Internal Error', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(httpError, mockArgumentsHost);

    expect(Sentry.captureException).toHaveBeenCalledWith(httpError);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should NOT capture 4xx HttpExceptions (e.g. 400 Bad Request, 404 Not Found) in Sentry', () => {
    const badRequestError = new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);

    filter.catch(badRequestError, mockArgumentsHost);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Invalid payload',
      statusCode: 400,
    });
  });

  it('should not throw if SENTRY_DSN is not configured', () => {
    delete process.env.SENTRY_DSN;
    const error = new Error('Random error');

    filter.catch(error, mockArgumentsHost);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});

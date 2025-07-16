import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Injectable,
  } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { Response } from 'express';
  
  @Injectable()
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
  
      let status: number;
      let details: string | string[];
      let responseDescription = 'Request failed';
  
      // Handle known error types
      if (exception instanceof HttpException) {
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
  
        details =
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'message' in exceptionResponse
            ? (exceptionResponse as any).message
            : exceptionResponse;
      } else if (this.isPrismaClientError(exception)) {
        status = HttpStatus.BAD_REQUEST; // Default status for Prisma errors
        const prismaError = exception as Prisma.PrismaClientKnownRequestError;
  
        // Map Prisma error codes to meaningful messages
        switch (prismaError.code) {
          case 'P2002': // Unique constraint violation
            responseDescription = 'Duplicate entry';
            details = `The field ${this.extractPrismaField(
              prismaError.meta,
            )} must be unique.`;
            break;
          case 'P2025': // Record not found
            status = HttpStatus.NOT_FOUND;
            responseDescription = 'Record not found';
            details = prismaError.message;
            break;
          default:
            responseDescription = 'Database error';
            details = prismaError.message;
        }
      } else {
        // Default fallback for unknown errors
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        details = (exception as any)?.message || 'Internal server error';
      }
  
      // Ensure details are in an array format for consistency
      if (!Array.isArray(details)) {
        details = [details];
      }
  
      // Respond with a structured error message
      response.status(status).json({
        success: false,
        response_code: '01',
        response_description: responseDescription,
        details,
      });
    }
  
    /**
     * Helper to check if the exception is a Prisma Client Known Request Error
     * @param exception - The error to check
     * @returns boolean
     */
    private isPrismaClientError(exception: unknown): exception is Prisma.PrismaClientKnownRequestError {
      return (
        exception instanceof Prisma.PrismaClientKnownRequestError &&
        exception.code !== undefined
      );
    }
  
    /**
     * Extracts the field name from Prisma's error metadata
     * @param meta - Prisma error metadata
     * @returns string
     */
    private extractPrismaField(meta: Prisma.PrismaClientKnownRequestError['meta']): string {
      if (meta && 'target' in meta && Array.isArray(meta.target)) {
        return meta.target.join(', ');
      }
      return 'unknown field';
    }
  }
  
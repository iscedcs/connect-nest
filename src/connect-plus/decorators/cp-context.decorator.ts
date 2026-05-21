import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CpRequestContext } from '../types/cp-request.types';
import { Request } from 'express';

export const CpContext = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CpRequestContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { cp: CpRequestContext }>();
    return req.cp;
  },
);

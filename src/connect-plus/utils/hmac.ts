import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): void {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
}

import { SetMetadata } from '@nestjs/common';

export const CONNECT_PLUS_KEY = 'connectPlus';

/** Apply to any controller or route handler that requires a Connect Plus subscription.
 *  The ConnectPlusGuard reads `iscePermissions.connect_plus` from the JWT — no DB call needed.
 *
 *  @example
 *  @ConnectPlus()
 *  @Get('/analytics')
 *  getAnalytics() { ... }
 */
export const ConnectPlus = () => SetMetadata(CONNECT_PLUS_KEY, true);

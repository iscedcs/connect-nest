import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AuthClientService } from '../auth/auth-client.service';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(private readonly authClient: AuthClientService) {}

  onModuleInit() {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize Firebase Admin', err);
    }
  }

  /**
   * Send a push notification to all session devices of a user.
   * Silently no-ops if the user has no FCM tokens or Firebase is not configured.
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.initialized) return;

    let tokens: string[];
    try {
      tokens = await this.authClient.getFcmTokens(userId);
    } catch {
      return;
    }

    if (!tokens.length) return;

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      // Remove stale tokens
      const staleTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          (res.error?.code === 'messaging/registration-token-not-registered' ||
            res.error?.code === 'messaging/invalid-registration-token')
        ) {
          staleTokens.push(tokens[idx]);
        }
      });

      if (staleTokens.length) {
        this.logger.debug(
          `${staleTokens.length} stale FCM token(s) detected for user ${userId}`,
        );
      }

      this.logger.debug(
        `Push sent to user ${userId}: ${response.successCount} ok, ${response.failureCount} failed`,
      );
    } catch (err) {
      this.logger.error(`Failed to send push to user ${userId}`, err);
    }
  }
}

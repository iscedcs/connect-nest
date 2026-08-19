import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SystemConfig } from '../generated/prisma/client';
import {
  UpdateSubscriptionConfigDto,
  SubscriptionBypassMode,
} from './dto/system-config.dto';

const DEFAULT_CONFIG_ID = 'default';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);
  private cachedConfig: SystemConfig | null = null;
  private lastCacheTime = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

  constructor(private readonly db: DatabaseService) {}

  /**
   * Retrieve the current system configuration with caching and auto-seeding.
   */
  async getConfig(): Promise<SystemConfig> {
    const now = Date.now();
    if (this.cachedConfig && now - this.lastCacheTime < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    try {
      let config = await this.db.systemConfig.findUnique({
        where: { id: DEFAULT_CONFIG_ID },
      });

      if (!config) {
        config = await this.db.systemConfig.create({
          data: {
            id: DEFAULT_CONFIG_ID,
            personalSubscriptionsEnabled: true,
            connectPlusSubscriptionsEnabled: true,
            bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
          },
        });
        this.logger.log('Seeded default SystemConfig configuration');
      }

      this.cachedConfig = config;
      this.lastCacheTime = now;
      return config;
    } catch (error) {
      this.logger.error(`Failed to fetch system config: ${error.message}`, error.stack);
      // Fallback safe default in case of DB glitch
      if (this.cachedConfig) return this.cachedConfig;
      return {
        id: DEFAULT_CONFIG_ID,
        personalSubscriptionsEnabled: true,
        connectPlusSubscriptionsEnabled: true,
        bypassMode: SubscriptionBypassMode.OPEN_ACCESS,
        maintenanceReason: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Update the system subscription settings and invalidate cache.
   */
  async updateConfig(
    dto: UpdateSubscriptionConfigDto,
    updatedBy?: string,
  ): Promise<SystemConfig> {
    const current = await this.getConfig();

    const updated = await this.db.systemConfig.upsert({
      where: { id: DEFAULT_CONFIG_ID },
      update: {
        personalSubscriptionsEnabled:
          dto.personalSubscriptionsEnabled ?? current.personalSubscriptionsEnabled,
        connectPlusSubscriptionsEnabled:
          dto.connectPlusSubscriptionsEnabled ??
          current.connectPlusSubscriptionsEnabled,
        bypassMode: dto.bypassMode ?? current.bypassMode,
        maintenanceReason:
          dto.maintenanceReason !== undefined
            ? dto.maintenanceReason
            : current.maintenanceReason,
        updatedBy: updatedBy ?? current.updatedBy,
      },
      create: {
        id: DEFAULT_CONFIG_ID,
        personalSubscriptionsEnabled: dto.personalSubscriptionsEnabled ?? true,
        connectPlusSubscriptionsEnabled:
          dto.connectPlusSubscriptionsEnabled ?? true,
        bypassMode: dto.bypassMode ?? SubscriptionBypassMode.OPEN_ACCESS,
        maintenanceReason: dto.maintenanceReason ?? null,
        updatedBy: updatedBy ?? null,
      },
    });

    this.cachedConfig = updated;
    this.lastCacheTime = Date.now();
    this.logger.log(
      `System configuration updated by ${updatedBy || 'admin'}: personal=${updated.personalSubscriptionsEnabled}, connectPlus=${updated.connectPlusSubscriptionsEnabled}, mode=${updated.bypassMode}`,
    );

    return updated;
  }

  /**
   * Check if personal (B2C) subscriptions are enabled.
   */
  async isPersonalSubscriptionEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.personalSubscriptionsEnabled;
  }

  /**
   * Check if Connect Plus (B2B) subscriptions are enabled.
   */
  async isConnectPlusSubscriptionEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.connectPlusSubscriptionsEnabled;
  }

  /**
   * Check if personal subscriptions should bypass plan limits (i.e. subscriptions disabled in OPEN_ACCESS mode).
   */
  async isPersonalBypassed(): Promise<boolean> {
    const config = await this.getConfig();
    return (
      !config.personalSubscriptionsEnabled &&
      config.bypassMode === SubscriptionBypassMode.OPEN_ACCESS
    );
  }

  /**
   * Check if Connect Plus subscriptions should bypass limits (i.e. subscriptions disabled in OPEN_ACCESS mode).
   */
  async isConnectPlusBypassed(): Promise<boolean> {
    const config = await this.getConfig();
    return (
      !config.connectPlusSubscriptionsEnabled &&
      config.bypassMode === SubscriptionBypassMode.OPEN_ACCESS
    );
  }

  /**
   * Invalidate local in-memory cache manually (e.g. for testing).
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.lastCacheTime = 0;
  }
}

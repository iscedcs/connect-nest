import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { UpdateConnectConfigDto, ReorderModulesDto } from './dto/connect-config.dto';

@Injectable()
export class ConnectConfigService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getConfig(user: any, profileId: string) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      let config = await this.databaseService.connectConfig.findFirst({ where: { profileId } });

      if (!config) {
        // Create default config if it doesn't exist
        config = await this.databaseService.connectConfig.create({
          data: {
            profileId,
            modules: [],
            theme: { mode: 'light', primary: '#0EA5E9', accent: '#F59E0B' },
            branding: {},
          },
        });
      }

      return { success: true, message: 'Config retrieved successfully', data: { config } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async updateConfig(user: any, profileId: string, dto: UpdateConnectConfigDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      let config = await this.databaseService.connectConfig.findFirst({ where: { profileId } });

      const updateData: any = {};
      if (dto.modules !== undefined) updateData.modules = dto.modules as any;
      if (dto.theme !== undefined) updateData.theme = dto.theme as any;
      if (dto.branding !== undefined) updateData.branding = dto.branding as any;

      if (config) {
        const updatedConfig = await this.databaseService.connectConfig.update({
          where: { id: config.id },
          data: updateData,
        });
        return { success: true, message: 'Config updated successfully', data: { config: updatedConfig } };
      } else {
        const newConfig = await this.databaseService.connectConfig.create({
        data: {
          profileId,
          modules: (dto.modules || []) as any,
          theme: (dto.theme || { mode: 'light', primary: '#0EA5E9', accent: '#F59E0B' }) as any,
          branding: (dto.branding || {}) as any,
        },
        });
        return { success: true, message: 'Config created successfully', data: { config: newConfig } };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async reorderModules(user: any, profileId: string, dto: ReorderModulesDto) {
    try {
      const profile = await this.databaseService.profile.findFirst({ where: { id: profileId, userId: user.id, deletedAt: null } });
      if (!profile) return { success: false, message: 'Profile not found' };

      let config = await this.databaseService.connectConfig.findFirst({ where: { profileId } });
      if (!config) return { success: false, message: 'Config not found' };

      const modules = (config.modules as any[]) || [];
      const moduleMap = new Map(modules.map((m, idx) => [m.id, { ...m, order: idx + 1 }]));

      // Update order based on provided order
      dto.module_ids.forEach((moduleId, index) => {
        if (moduleMap.has(moduleId)) {
          moduleMap.set(moduleId, { ...moduleMap.get(moduleId), order: index + 1 });
        }
      });

      const reorderedModules = Array.from(moduleMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

      const updatedConfig = await this.databaseService.connectConfig.update({
        where: { id: config.id },
        data: { modules: reorderedModules as any },
      });

      return { success: true, message: 'Modules reordered successfully', data: { config: updatedConfig } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}


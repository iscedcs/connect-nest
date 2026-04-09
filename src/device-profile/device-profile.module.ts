import { Module } from '@nestjs/common';
import {
  DeviceProfileController,
  DeviceBindingsController,
  AdminDeviceProfileController,
} from './device-profile.controller';
import { DeviceProfileService } from './device-profile.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    DeviceProfileController,
    DeviceBindingsController,
    AdminDeviceProfileController,
  ],
  providers: [DeviceProfileService],
  exports: [DeviceProfileService],
})
export class DeviceProfileModule {}

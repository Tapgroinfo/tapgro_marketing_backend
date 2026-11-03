import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettingsSchema } from '../../db/schemas/setting.schema';
import { SettingsController } from './settings.controller';
import { PublicLegalController } from './public-legal.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SystemSettings', schema: SystemSettingsSchema },
    ]),
  ],
  controllers: [SettingsController, PublicLegalController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

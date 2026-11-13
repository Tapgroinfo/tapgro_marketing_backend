import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SocialChannel,
  SocialChannelSchema,
  SocialConnectSession,
  SocialConnectSessionSchema,
  SocialProfile,
  SocialProfileSchema,
} from '../../db/schemas/social.schema';
import { Platform, PlatformSchema } from '../../db/schemas/platform.schema';
import { SettingsModule } from '../settings/settings.module';
import { LeadModule } from '../lead/lead.module';
import { SocialController, SocialPublicController } from './social.controller';
import { WebhookController } from './webhook.controller';
import { SocialService } from './social.service';
import { ZernioClient } from './zernio.client';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialProfile.name, schema: SocialProfileSchema },
      { name: SocialChannel.name, schema: SocialChannelSchema },
      { name: SocialConnectSession.name, schema: SocialConnectSessionSchema },
      { name: Platform.name, schema: PlatformSchema },
    ]),
    SettingsModule,
    LeadModule,
  ],
  controllers: [SocialController, SocialPublicController, WebhookController],
  providers: [SocialService, ZernioClient],
  exports: [SocialService, ZernioClient],
})
export class SocialModule {}

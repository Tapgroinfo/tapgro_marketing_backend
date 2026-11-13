import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../../db/schemas/lead.schema';
import {
  SocialChannel,
  SocialChannelSchema,
  SocialProfile,
  SocialProfileSchema,
} from '../../db/schemas/social.schema';
import { LeadAdminController } from './lead.admin.controller';
import { LeadService } from './lead.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: SocialProfile.name, schema: SocialProfileSchema },
      { name: SocialChannel.name, schema: SocialChannelSchema },
    ]),
  ],
  controllers: [LeadAdminController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}

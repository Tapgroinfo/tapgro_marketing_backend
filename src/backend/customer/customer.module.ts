import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Customer,
  CustomerSchema,
  TapgroMember,
  TapgroMemberSchema,
} from '../../db/schemas/customer.schema';
import { Lead, LeadSchema } from '../../db/schemas/lead.schema';
import {
  SocialChannel,
  SocialChannelSchema,
  SocialProfile,
  SocialProfileSchema,
} from '../../db/schemas/social.schema';
import { CustomerAdminController } from './customer.admin.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: TapgroMember.name, schema: TapgroMemberSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: SocialProfile.name, schema: SocialProfileSchema },
      { name: SocialChannel.name, schema: SocialChannelSchema },
    ]),
  ],
  controllers: [CustomerAdminController],
  providers: [CustomerService],
  exports: [CustomerService, MongooseModule],
})
export class CustomerModule {}

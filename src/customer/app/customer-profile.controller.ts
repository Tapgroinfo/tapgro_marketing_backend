import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CustomerDocument } from '../../db/schemas/customer.schema';
import { CustomerService } from '../../backend/customer/customer.service';
import { SocialService } from '../../backend/social/social.service';
import { LeadService } from '../../backend/lead/lead.service';
import { CurrentCustomer, CustomerJwtGuard } from '../auth/customer-auth.guard';
import { UpdateMyProfileDto } from '../auth/dto/customer-auth.dto';

@ApiTags('Customer Profile')
@ApiBearerAuth('customerBearerAuth')
@UseGuards(CustomerJwtGuard)
@Controller('/api/customer/v1')
export class CustomerProfileController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly socialService: SocialService,
    private readonly leadService: LeadService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'My profile + home stats',
    description:
      'Includes isTapgroUser flag, connected channel count and lead summary.',
  })
  async me(@CurrentCustomer() customer: CustomerDocument) {
    const profile = await this.socialService.findCustomerProfile(customer.id);
    const channels = profile
      ? await this.socialService.findProfileChannels(profile._id)
      : [];
    return {
      success: true,
      data: {
        ...this.customerService.toSafe(customer),
        profileComplete: !!(customer.name && customer.businessName),
        channels: {
          connected: channels.filter((c) => c.status !== 'needs_reconnect')
            .length,
          needsReconnect: channels.filter((c) => c.status === 'needs_reconnect')
            .length,
        },
        leads: await this.leadService.summary(customer.id),
      },
    };
  }

  @Put('me')
  async update(
    @CurrentCustomer() customer: CustomerDocument,
    @Body() dto: UpdateMyProfileDto,
  ) {
    customer.set(dto);
    await customer.save();
    return {
      success: true,
      message: 'Profile updated',
      data: this.customerService.toSafe(customer),
    };
  }
}

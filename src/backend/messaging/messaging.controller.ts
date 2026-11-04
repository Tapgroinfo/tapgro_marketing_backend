import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { TemplateService } from '../template/template.service';
import { MessagingService } from './messaging.service';
import { TestMessageDto } from './dto/testMessage.dto';

@ApiTags('Message Templates')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly templateService: TemplateService,
  ) {}

  @RequirePermissions('update:template')
  @Post('messaging/test')
  @ApiOperation({
    summary: 'Send a template to a test recipient',
    description:
      'Checks gateway settings end to end. Sends even if the template is inactive. Result is also in integration logs.',
  })
  async test(@Body() dto: TestMessageDto) {
    const template = await this.templateService.findOne(dto.templateId);
    const result = await this.messagingService.sendWithTemplate(
      template,
      dto.to,
      dto.variables,
    );
    return {
      success: result.sent,
      message: result.sent ? 'Test message sent' : 'Test message not sent',
      data: result,
    };
  }
}

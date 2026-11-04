import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { TemplateModule } from '../template/template.module';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { WhatsappService } from './whatsapp.service';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Global()
@Module({
  imports: [SettingsModule, TemplateModule],
  controllers: [MessagingController],
  providers: [EmailService, SmsService, WhatsappService, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}

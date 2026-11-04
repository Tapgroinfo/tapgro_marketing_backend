import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  IntegrationLog,
  IntegrationLogSchema,
} from '../../db/schemas/integrationLog.schema';
import { SettingsModule } from '../settings/settings.module';
import { IntegrationLogController } from './integrationLog.controller';
import { IntegrationLogService } from './integrationLog.service';
import { WebhookController } from './webhook.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
    ]),
    SettingsModule,
  ],
  controllers: [IntegrationLogController, WebhookController],
  providers: [IntegrationLogService],
  exports: [IntegrationLogService],
})
export class IntegrationLogModule {}

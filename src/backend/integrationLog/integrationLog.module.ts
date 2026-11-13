import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  IntegrationLog,
  IntegrationLogSchema,
} from '../../db/schemas/integrationLog.schema';
import { IntegrationLogController } from './integrationLog.controller';
import { IntegrationLogService } from './integrationLog.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
    ]),
  ],
  controllers: [IntegrationLogController],
  providers: [IntegrationLogService],
  exports: [IntegrationLogService],
})
export class IntegrationLogModule {}

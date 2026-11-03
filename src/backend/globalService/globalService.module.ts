import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GlobalService } from './global.service';
import { AuditTrailSchema } from '../../db/schemas/auditTrail.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AuditTrail', schema: AuditTrailSchema },
    ]),
  ],
  providers: [GlobalService],
  exports: [GlobalService],
})
export class GlobalServiceModule {}

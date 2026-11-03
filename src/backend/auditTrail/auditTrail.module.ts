import { Module } from '@nestjs/common';
import { AuditTrailController } from './auditTrail.controller';
import { AuditTrailService } from './auditTrail.service';

@Module({
  controllers: [AuditTrailController],
  providers: [AuditTrailService],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}

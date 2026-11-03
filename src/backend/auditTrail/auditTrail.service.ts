import { Injectable } from '@nestjs/common';
import { GlobalService } from '../globalService/global.service';
import { Sort } from '../../utils/pagination';

@Injectable()
export class AuditTrailService {
  constructor(private globalService: GlobalService) {}

  async findAllAuditTrails(params: {
    limit?: number;
    page?: number;
    search?: string;
    sort_attr?: string;
    sort?: Sort;
    auditType?: string;
    action?: string;
    updatedBy?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return await this.globalService.findAllAuditTrails(params);
  }
}

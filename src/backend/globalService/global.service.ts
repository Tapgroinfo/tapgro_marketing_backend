import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder } from 'mongoose';
import { AuditTrail } from '../../db/schemas/auditTrail.schema';
import { auditType } from '../../utils/auditTypeEnum';
import { Pagination, Sort } from '../../utils/pagination';
import { PaginationResult } from '../../utils/interfaces/pagination.interface';

export interface AuditData {
  updatedBy: string;
  action: string;
  description: string;
  auditType: auditType;
}

@Injectable()
export class GlobalService {
  constructor(
    @InjectModel('AuditTrail')
    private auditTrailModel: Model<AuditTrail>,
  ) {}

  async createAuditTrail(auditData: AuditData, updatedDetail: unknown) {
    await new this.auditTrailModel({
      ...auditData,
      updatedTime: new Date(),
      additionalDetail: JSON.stringify(updatedDetail),
    }).save();
    return true;
  }

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
    const query: Record<string, any> = {};

    if (params.search) {
      query['$or'] = [
        { description: { $regex: params.search, $options: 'i' } },
        { action: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.auditType) {
      query['auditType'] = params.auditType;
    }
    if (params.action) {
      query['action'] = params.action;
    }
    if (params.updatedBy) {
      query['updatedBy'] = params.updatedBy;
    }
    if (params.startDate || params.endDate) {
      query['updatedTime'] = {};
      if (params.startDate) {
        query['updatedTime']['$gte'] = new Date(params.startDate);
      }
      if (params.endDate) {
        query['updatedTime']['$lte'] = new Date(params.endDate);
      }
    }

    const sortOptions: Record<string, SortOrder> = {
      [params.sort_attr || 'updatedTime']: params.sort === Sort.ASC ? 1 : -1,
    };

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;

    const [items, totalCount] = await Promise.all([
      this.auditTrailModel
        .find(query)
        .populate({ path: 'updatedBy', select: 'name email phone image' })
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.auditTrailModel.countDocuments(query).exec(),
    ]);

    return {
      success: true,
      totalCount,
      data: items,
      pagination: {
        total: totalCount,
        perPage: limit,
        currentPageTotal: items.length,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async paginate<T>({
    model,
    query = {},
    pagination,
    select = {},
    populate,
  }: {
    model: Model<any>;
    query?: Record<string, unknown>;
    pagination: Pagination;
    select?: Record<string, number> | string;
    populate?: string;
  }): Promise<PaginationResult<T>> {
    const page = Number(pagination.page) || 1;
    const perPage = Number(pagination.limit) || 10;

    const sortOptions: Record<string, SortOrder> = {
      [pagination.sort_attr || 'createdAt']:
        pagination.sort === Sort.ASC ? 1 : -1,
    };

    let findQuery = model
      .find(query)
      .select(select)
      .sort(sortOptions)
      .skip((page - 1) * perPage)
      .limit(perPage);
    if (populate) {
      findQuery = findQuery.populate(populate);
    }

    const [items, totalCount] = await Promise.all([
      findQuery.exec(),
      model.countDocuments(query).exec(),
    ]);

    return {
      data: items as T[],
      pagination: {
        total: totalCount,
        perPage,
        currentPageTotal: items.length,
        currentPage: page,
        totalPages: Math.ceil(totalCount / perPage),
      },
    };
  }
}

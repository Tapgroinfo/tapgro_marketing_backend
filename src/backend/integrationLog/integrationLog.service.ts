import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IntegrationLog } from '../../db/schemas/integrationLog.schema';
import { GlobalService } from '../globalService/global.service';
import { Pagination } from '../../utils/pagination';

export type IntegrationLogInput = Partial<IntegrationLog> &
  Pick<IntegrationLog, 'type' | 'provider' | 'direction' | 'status'>;

export type IntegrationLogFilter = Pagination & {
  type?: string;
  provider?: string;
  status?: string;
  direction?: string;
  startDate?: string;
  endDate?: string;
};

const REDACT_KEYS = /pass(word)?|secret|token|api[-_]?key|authorization/i;

@Injectable()
export class IntegrationLogService {
  private readonly logger = new Logger(IntegrationLogService.name);

  constructor(
    @InjectModel(IntegrationLog.name)
    private readonly logModel: Model<IntegrationLog>,
    private readonly globalService: GlobalService,
  ) {}

  /** Never throws — logging must not break the caller. */
  async log(entry: IntegrationLogInput) {
    try {
      return await this.logModel.create({
        ...entry,
        request: this.redact(entry.request),
        response: this.redact(entry.response),
      });
    } catch (error) {
      this.logger.error(`Failed to write integration log: ${String(error)}`);
      return null;
    }
  }

  async findAll(filter: IntegrationLogFilter) {
    return this.globalService.paginate<IntegrationLog>({
      model: this.logModel,
      query: this.buildQuery(filter),
      pagination: filter,
      select: '-request -response',
    });
  }

  buildQuery(filter: IntegrationLogFilter) {
    const query: Record<string, any> = {};
    for (const key of ['type', 'provider', 'status', 'direction'] as const) {
      if (filter[key]) query[key] = filter[key];
    }
    if (filter.search) {
      query.$or = [
        { target: { $regex: filter.search, $options: 'i' } },
        { event: { $regex: filter.search, $options: 'i' } },
      ];
    }
    if (filter.startDate || filter.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }
    return query;
  }

  async findOne(id: string) {
    const log = await this.logModel.findById(id).exec();
    if (!log) {
      throw new NotFoundException('Log not found');
    }
    return log;
  }

  private redact(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined || depth > 6) return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item, depth + 1));
    }
    if (typeof value === 'object' && !(value instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        out[key] = REDACT_KEYS.test(key)
          ? '[redacted]'
          : this.redact(val, depth + 1);
      }
      return out;
    }
    return value;
  }
}

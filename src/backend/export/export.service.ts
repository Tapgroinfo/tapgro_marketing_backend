import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import ExcelJS from 'exceljs';
import { User } from '../../db/schemas/user.schema';
import { Plan } from '../../db/schemas/plan.schema';
import { Platform } from '../../db/schemas/platform.schema';
import { SupportTicket } from '../../db/schemas/supportTicket.schema';
import { IntegrationLog } from '../../db/schemas/integrationLog.schema';
import { LoginHistory } from '../../db/schemas/loginHistory.schema';
import { AuditTrail } from '../../db/schemas/auditTrail.schema';
import { hasPermissions } from '../../utils/permission-check.util';

export const EXPORT_ENTITIES = [
  'admins',
  'audit-trails',
  'login-history',
  'support-tickets',
  'integration-logs',
  'plans',
  'platforms',
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];
export type ExportFormat = 'csv' | 'xlsx';

export const MAX_EXPORT_ROWS = 10_000;

export type ExportFilter = {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

type Row = Record<string, any>;
type Column = { header: string; value: (row: Row) => unknown };

type EntityConfig = {
  permission: string;
  model: Model<any>;
  dateField: string;
  searchFields: string[];
  statusField?: string;
  baseQuery?: Record<string, unknown>;
  populate?: { path: string; select: string };
  columns: Column[];
};

const date = (v: unknown) => (v ? new Date(v as string).toISOString() : '');
const name = (ref: unknown) => (ref as { name?: string } | null)?.name ?? '';

@Injectable()
export class ExportService {
  private readonly entities: Record<ExportEntity, EntityConfig>;

  constructor(
    @InjectModel('User') userModel: Model<User>,
    @InjectModel(Plan.name) planModel: Model<Plan>,
    @InjectModel(Platform.name) platformModel: Model<Platform>,
    @InjectModel(SupportTicket.name) ticketModel: Model<SupportTicket>,
    @InjectModel(IntegrationLog.name) logModel: Model<IntegrationLog>,
    @InjectModel(LoginHistory.name) loginModel: Model<LoginHistory>,
    @InjectModel('AuditTrail') auditModel: Model<AuditTrail>,
  ) {
    this.entities = {
      admins: {
        permission: 'read:admin',
        model: userModel,
        dateField: 'createdAt',
        searchFields: ['name', 'email', 'phone'],
        baseQuery: { isDeleted: false },
        populate: { path: 'role', select: 'role' },
        columns: [
          { header: 'Name', value: (r) => r.name },
          { header: 'Email', value: (r) => r.email },
          { header: 'Phone', value: (r) => r.phone },
          { header: 'Role', value: (r) => r.role?.role },
          { header: 'Active', value: (r) => (r.status ? 'Yes' : 'No') },
          { header: 'Last login', value: (r) => date(r.lastLogin) },
          { header: 'Created', value: (r) => date(r.createdAt) },
        ],
      },
      'audit-trails': {
        permission: 'read:audit_trail',
        model: auditModel,
        dateField: 'updatedTime',
        searchFields: ['description', 'action'],
        populate: { path: 'updatedBy', select: 'name' },
        columns: [
          { header: 'Time', value: (r) => date(r.updatedTime) },
          { header: 'Admin', value: (r) => name(r.updatedBy) },
          { header: 'Type', value: (r) => r.auditType },
          { header: 'Action', value: (r) => r.action },
          { header: 'Description', value: (r) => r.description },
        ],
      },
      'login-history': {
        permission: 'read:login_history',
        model: loginModel,
        dateField: 'createdAt',
        searchFields: ['email', 'ip'],
        columns: [
          { header: 'Time', value: (r) => date(r.createdAt) },
          { header: 'Email', value: (r) => r.email },
          { header: 'Result', value: (r) => r.result },
          { header: 'IP', value: (r) => r.ip },
          { header: 'User agent', value: (r) => r.userAgent },
        ],
      },
      'support-tickets': {
        permission: 'read:support',
        model: ticketModel,
        dateField: 'createdAt',
        searchFields: ['ticketNo', 'subject', 'email', 'name'],
        statusField: 'status',
        populate: { path: 'assignedTo', select: 'name' },
        columns: [
          { header: 'Ticket', value: (r) => r.ticketNo },
          { header: 'Created', value: (r) => date(r.createdAt) },
          { header: 'Name', value: (r) => r.name },
          { header: 'Email', value: (r) => r.email },
          { header: 'Phone', value: (r) => r.phone },
          { header: 'Subject', value: (r) => r.subject },
          { header: 'Category', value: (r) => r.category },
          { header: 'Status', value: (r) => r.status },
          { header: 'Priority', value: (r) => r.priority },
          { header: 'Assigned to', value: (r) => name(r.assignedTo) },
          { header: 'Replies', value: (r) => r.replies?.length ?? 0 },
          { header: 'Resolved', value: (r) => date(r.resolvedAt) },
        ],
      },
      'integration-logs': {
        permission: 'read:integration_log',
        model: logModel,
        dateField: 'createdAt',
        searchFields: ['target', 'event'],
        statusField: 'status',
        columns: [
          { header: 'Time', value: (r) => date(r.createdAt) },
          { header: 'Type', value: (r) => r.type },
          { header: 'Provider', value: (r) => r.provider },
          { header: 'Direction', value: (r) => r.direction },
          { header: 'Event', value: (r) => r.event },
          { header: 'Status', value: (r) => r.status },
          { header: 'Target', value: (r) => r.target },
          { header: 'HTTP', value: (r) => r.statusCode },
          { header: 'Error', value: (r) => r.error },
          { header: 'Duration ms', value: (r) => r.durationMs },
        ],
      },
      plans: {
        permission: 'read:plan',
        model: planModel,
        dateField: 'createdAt',
        searchFields: ['name', 'slug'],
        baseQuery: { isDeleted: false },
        columns: [
          { header: 'Name', value: (r) => r.name },
          { header: 'Slug', value: (r) => r.slug },
          { header: 'Monthly', value: (r) => r.priceMonthly },
          { header: 'Yearly', value: (r) => r.priceYearly },
          { header: 'Currency', value: (r) => r.currency },
          { header: 'Trial days', value: (r) => r.trialDays },
          { header: 'Active', value: (r) => (r.isActive ? 'Yes' : 'No') },
          { header: 'Public', value: (r) => (r.isPublic ? 'Yes' : 'No') },
        ],
      },
      platforms: {
        permission: 'read:platform',
        model: platformModel,
        dateField: 'createdAt',
        searchFields: ['name', 'slug'],
        baseQuery: { isDeleted: false },
        columns: [
          { header: 'Name', value: (r) => r.name },
          { header: 'Slug', value: (r) => r.slug },
          {
            header: 'Capabilities',
            value: (r) => (r.capabilities || []).join(', '),
          },
          { header: 'Active', value: (r) => (r.isActive ? 'Yes' : 'No') },
          { header: 'Sort order', value: (r) => r.sortOrder },
        ],
      },
    };
  }

  async export(
    entity: string,
    format: ExportFormat,
    filter: ExportFilter,
    authUser: unknown,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const config = this.entities[entity as ExportEntity];
    if (!config) {
      throw new NotFoundException(
        `Unknown export. Use one of: ${EXPORT_ENTITIES.join(', ')}`,
      );
    }
    if (!hasPermissions(authUser as Row, [config.permission])) {
      throw new ForbiddenException(
        'You do not have permission to export this data',
      );
    }

    const query: Record<string, any> = { ...(config.baseQuery || {}) };
    if (filter.search) {
      query.$or = config.searchFields.map((field) => ({
        [field]: { $regex: filter.search, $options: 'i' },
      }));
    }
    if (filter.status && config.statusField) {
      query[config.statusField] = filter.status;
    }
    if (filter.startDate || filter.endDate) {
      const range: Record<string, Date> = {};
      if (filter.startDate) range.$gte = new Date(filter.startDate);
      if (filter.endDate) range.$lte = new Date(filter.endDate);
      if (Object.values(range).some((d) => isNaN(d.getTime()))) {
        throw new BadRequestException('Invalid startDate / endDate');
      }
      query[config.dateField] = range;
    }

    let finder = config.model
      .find(query)
      .sort({ [config.dateField]: -1 })
      .limit(MAX_EXPORT_ROWS);
    if (config.populate) {
      finder = finder.populate(config.populate.path, config.populate.select);
    }
    const rows = (await finder.lean().exec()) as Row[];

    const headers = config.columns.map((c) => c.header);
    const values = rows.map((row) =>
      config.columns.map((c) => this.cell(c.value(row))),
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${entity}-${stamp}.${format}`;
    if (format === 'xlsx') {
      return {
        buffer: await this.toXlsx(entity, headers, values),
        filename,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    return {
      buffer: this.toCsv(headers, values),
      filename,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private cell(value: unknown): string | number {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value;
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    // Block spreadsheet formula injection
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  }

  private toCsv(headers: string[], rows: Array<Array<string | number>>) {
    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers, ...rows].map((r) => r.map(escape).join(','));
    // BOM so Excel opens UTF-8 (₹, Hindi names) correctly
    return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
  }

  private async toXlsx(
    sheetName: string,
    headers: string[],
    rows: Array<Array<string | number>>,
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    sheet.addRow(headers).font = { bold: true };
    sheet.addRows(rows);
    headers.forEach((header, i) => {
      const longest = Math.max(
        header.length,
        ...rows.map((r) => String(r[i]).length),
      );
      sheet.getColumn(i + 1).width = Math.min(50, Math.max(12, longest + 2));
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

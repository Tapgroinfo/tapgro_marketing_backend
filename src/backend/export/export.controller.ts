import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import {
  EXPORT_ENTITIES,
  ExportService,
  MAX_EXPORT_ROWS,
} from './export.service';
import type { ExportFormat } from './export.service';

@ApiTags('Export')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard)
@Controller('/api/backend/v1')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('export/:entity')
  @ApiOperation({
    summary: 'Download a list as CSV or Excel',
    description: `Requires read permission on that module. Max ${MAX_EXPORT_ROWS} rows, newest first.`,
  })
  @ApiParam({ name: 'entity', enum: EXPORT_ENTITIES })
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'support-tickets / integration-logs only',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async export(
    @Param('entity') entity: string,
    @AuthAdmin() authUser: any,
    @Res({ passthrough: true }) res: Response,
    @Query('format', new ParseEnumPipe(['csv', 'xlsx'], { optional: true }))
    format?: ExportFormat,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const file = await this.exportService.export(
      entity,
      format || 'csv',
      { search, status, startDate, endDate },
      authUser,
    );
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
    });
    return new StreamableFile(file.buffer);
  }
}

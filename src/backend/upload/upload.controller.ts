import {
  Controller,
  ParseEnumPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_FOLDERS,
  UploadService,
} from './upload.service';
import type { UploadFolder } from './upload.service';

@ApiTags('Upload')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard)
@Controller('/api/backend/v1')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload an image or PDF (max 5 MB)',
    description:
      'Returns a URL to store on the record (profile image, logo, banner…).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiQuery({ name: 'folder', required: false, enum: UPLOAD_FOLDERS })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder', new ParseEnumPipe(UPLOAD_FOLDERS, { optional: true }))
    folder?: UploadFolder,
  ) {
    return {
      success: true,
      message: 'File uploaded successfully',
      data: await this.uploadService.upload(file, folder || 'misc'),
    };
  }
}

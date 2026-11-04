import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export const UPLOAD_FOLDERS = [
  'profile',
  'logo',
  'platform',
  'banner',
  'cms',
  'misc',
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const LOCAL_UPLOAD_DIR = 'uploads';

/** Detected from file bytes, not the client-sent mimetype. */
const SIGNATURES: Array<{
  mime: string;
  ext: string;
  test: (b: Buffer) => boolean;
}> = [
  {
    mime: 'image/png',
    ext: '.png',
    test: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/jpeg',
    ext: '.jpg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/gif',
    ext: '.gif',
    test: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  },
  {
    mime: 'image/webp',
    ext: '.webp',
    test: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'application/pdf',
    ext: '.pdf',
    test: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

export type UploadResult = {
  url: string;
  key: string;
  mimeType: string;
  size: number;
  storage: 's3' | 'local';
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly s3: S3Client | null;

  constructor(private readonly configService: ConfigService) {
    this.bucket =
      configService.get<string>('AWS_BUCKET') ||
      configService.get<string>('AWS_S3_BUCKET_NAME') ||
      '';
    this.region = configService.get<string>('AWS_REGION') || '';

    const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.s3 =
      this.bucket && this.region
        ? new S3Client({
            region: this.region,
            // Fall back to the default AWS credential chain (IAM role etc.)
            credentials:
              accessKeyId && secretAccessKey
                ? { accessKeyId, secretAccessKey }
                : undefined,
          })
        : null;
    if (!this.s3) {
      this.logger.warn(
        'AWS_BUCKET / AWS_REGION not set — uploads are stored locally in ./uploads',
      );
    }
  }

  async upload(
    file: Express.Multer.File | undefined,
    folder: UploadFolder,
  ): Promise<UploadResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File must be 5 MB or smaller');
    }
    const type = SIGNATURES.find((sig) => sig.test(file.buffer));
    if (!type) {
      throw new BadRequestException(
        'Only PNG, JPEG, GIF, WEBP images and PDF files are allowed',
      );
    }

    const key = `${folder}/${randomUUID()}${type.ext}`;
    try {
      const url = this.s3
        ? await this.putS3(key, file.buffer, type.mime)
        : await this.putLocal(key, file.buffer);
      return {
        url,
        key,
        mimeType: type.mime,
        size: file.size,
        storage: this.s3 ? 's3' : 'local',
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${String(error)}`);
      throw new InternalServerErrorException('File upload failed');
    }
  }

  private async putS3(key: string, body: Buffer, contentType: string) {
    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private async putLocal(key: string, body: Buffer) {
    const fullPath = join(process.cwd(), LOCAL_UPLOAD_DIR, key);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, body);
    const baseUrl = (this.configService.get<string>('APP_BASE_URL') || '')
      .trim()
      .replace(/\/$/, '');
    return `${baseUrl}/${LOCAL_UPLOAD_DIR}/${key}`;
  }
}

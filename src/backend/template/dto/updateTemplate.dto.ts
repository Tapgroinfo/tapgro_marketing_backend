import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { CreateTemplateDto } from './createTemplate.dto';

/** Channel cannot change after creation. */
export class UpdateTemplateDto extends PartialType(
  OmitType(CreateTemplateDto, ['channel'] as const),
) {}

export class PreviewTemplateDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { name: 'Priya', otp: '123456' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

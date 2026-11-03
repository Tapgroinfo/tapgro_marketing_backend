import { PartialType } from '@nestjs/swagger';
import { CreatePlatformDto } from './createPlatform.dto';

export class UpdatePlatformDto extends PartialType(CreatePlatformDto) {}

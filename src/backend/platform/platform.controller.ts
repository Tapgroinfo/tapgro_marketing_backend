import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PlatformService } from './platform.service';
import { CreatePlatformDto } from './dto/createPlatform.dto';
import { UpdatePlatformDto } from './dto/updatePlatform.dto';

@ApiTags('Platforms')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @RequirePermissions('create:platform')
  @Post('platform')
  @ApiOperation({ summary: 'Add a social platform' })
  async createPlatform(
    @Body() dto: CreatePlatformDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.platformService.createPlatformFun(dto, authUser.id);
  }

  @RequirePermissions('update:platform')
  @Put('platform/:id')
  @ApiOperation({
    summary: 'Update a social platform',
    description: 'Set `isActive` to enable / disable it for salons.',
  })
  async updatePlatform(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.platformService.updatePlatformFun(id, dto, authUser.id);
  }

  @RequirePermissions('read:platform')
  @Get('platforms')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getAllPlatforms(
    @Query('search') search?: string,
    @Query('isActive', new ParseBoolPipe({ optional: true }))
    isActive?: boolean,
  ) {
    const data = await this.platformService.findAllPlatformsFun({
      search,
      isActive,
    });
    return {
      success: true,
      message: 'Platforms retrieved successfully',
      data,
    };
  }

  @RequirePermissions('read:platform')
  @Get('platform/:id')
  async getPlatformById(@Param('id') id: string) {
    const data = await this.platformService.platformFindByIdFun(id);
    return {
      success: true,
      data,
    };
  }

  @RequirePermissions('delete:platform')
  @Delete('platform/:id')
  async deletePlatform(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return await this.platformService.deletePlatformFun(id, authUser.id);
  }
}

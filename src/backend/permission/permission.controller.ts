import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/createPermission.dto';
import { UpdatePermissionDto } from './dto/updatePermission.dto';

@ApiTags('Permissions')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @RequirePermissions('create:permission')
  @Post('permission')
  @ApiOperation({
    summary: 'Create permission module',
    description:
      'Adds a module slug that roles can grant create/view/edit/delete on.',
  })
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.permissionService.createPermissionFun(dto, authUser.id);
  }

  @RequirePermissions('update:permission')
  @Put('permission/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.permissionService.updatePermissionFun(
      id,
      dto,
      authUser.id,
    );
  }

  @RequirePermissions('read:permission')
  @Get('permissions')
  async getAllPermissions() {
    const data = await this.permissionService.findAllPermissionsFun();
    return {
      success: true,
      message: 'Permission retrieved successfully',
      data,
    };
  }

  @RequirePermissions('read:permission')
  @Get('permission/:id')
  async getPermissionById(@Param('id') id: string) {
    const data = await this.permissionService.permissionFindByIdFun(id);
    return {
      success: true,
      data,
    };
  }

  @RequirePermissions('delete:permission')
  @Delete('permission/:id')
  async deletePermission(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return await this.permissionService.deletePermissionFun(id, authUser.id);
  }
}

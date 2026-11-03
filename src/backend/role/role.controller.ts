import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtOnAuthGuard } from '../admin/guards/jwt-guard';
import { AuthAdmin } from '../admin/decorators/adminAuth.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/createRole.dto';
import { UpdateRoleDto } from './dto/updateRole.dto';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { RoleFields } from './model/model';

@ApiTags('Role')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class RoleController {
  constructor(private roleService: RoleService) {}

  @RequirePermissions('create:role')
  @Post('role')
  async createRoleFun(
    @Body() createRoleDto: CreateRoleDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.roleService.createRoleFun(createRoleDto, authUser.id);
  }

  @RequirePermissions('update:role')
  @Put('role/:id')
  async updateRoleFun(
    @Body() updateRoleDto: UpdateRoleDto,
    @AuthAdmin() authUser: any,
    @Param('id') id: string,
  ) {
    return await this.roleService.updateRoleFun(updateRoleDto, authUser.id, id);
  }

  @RequirePermissions('read:role')
  @Get('role/:id')
  async getRoleFun(@Param('id') id: string) {
    const data = await this.roleService.roleFindByIdFun(id);
    return {
      success: true,
      data,
    };
  }

  @RequirePermissions('read:role')
  @Get('roles')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort_attr', required: false, enum: RoleFields })
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  async getAllRoleWithPagination(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: RoleFields,
    @Query('sort') sort?: Sort,
  ) {
    const result = await this.roleService.findAllRoleWithPaginationFun({
      limit,
      page,
      search,
      sort_attr,
      sort,
    });
    return {
      message: 'Role retrieved successfully',
      ...result,
    };
  }

  /** Dropdown list — any logged-in admin. */
  @Get('roleList')
  async findAllRoleFun() {
    const roles = await this.roleService.findAllRoleFun();
    return {
      success: true,
      data: roles,
    };
  }

  @RequirePermissions('read:role')
  @Get('getAvailablePermissions')
  async getAvailablePermissions() {
    return await this.roleService.getAvailablePermissions();
  }

  @RequirePermissions('delete:role')
  @Delete('role/:id')
  async deleteRoleFun(@AuthAdmin() authUser: any, @Param('id') id: string) {
    return await this.roleService.deleteRoleFun(id, authUser.id);
  }
}

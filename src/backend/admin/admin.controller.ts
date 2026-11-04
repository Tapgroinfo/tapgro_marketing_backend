import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminCreateDto } from './dto/AdminCreateDto';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { JwtOnAuthGuard } from './guards/jwt-guard';
import { AuthAdmin } from './decorators/adminAuth.decorator';
import { UpdateAdminPasswordDto } from './dto/UpdateAdminPasswordDto';
import { UpdateAdminProfileDto } from './dto/UpdateAdminProfileDto';
import { UpdateAdminDto } from './dto/UpdateAdminDto';
import { UpdateAdminPermissionsDto } from './dto/UpdateAdminPermissionsDto';
import {
  AdminSetPasswordDto,
  UpdateAdminStatusDto,
} from './dto/PasswordReset.dto';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';

@ApiTags('Admins')
@ApiBearerAuth('backendBearerAuth')
@UseGuards(JwtOnAuthGuard, PermissionsGuard)
@Controller('/api/backend/v1')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
  ) {}

  @Get('adminProfile')
  async getAdminProfileFun(@AuthAdmin() authUser: any) {
    const admin = await this.adminService.getAdminProfileFun(authUser.id);
    if (!admin) {
      throw new UnauthorizedException({ message: 'Admin not found' });
    }
    return { success: true, data: admin };
  }

  @Put('adminProfile')
  updateAdminProfileFun(
    @Body() dto: UpdateAdminProfileDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.updateAdminProfileFun(dto, authUser.id);
  }

  @Post('changePassword')
  @ApiOperation({
    summary: 'Change own password',
    description:
      'Logs out other sessions and returns a fresh token + refreshToken for this device.',
  })
  updateAdminPasswordFun(
    @Body() dto: UpdateAdminPasswordDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.updateAdminPasswordFun(dto, authUser.id);
  }

  @RequirePermissions('create:admin')
  @Post('adminCreate')
  adminCreateServiceFun(
    @Body() dto: AdminCreateDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.adminCreateServiceFun(dto, authUser.id);
  }

  @RequirePermissions('read:admin')
  @Get('admins')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  @ApiQuery({ name: 'status', required: false, type: Boolean })
  @ApiQuery({ name: 'roleId', required: false, type: String })
  async getAllAdminsWithPagination(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
    @Query('status', new ParseBoolPipe({ optional: true })) status?: boolean,
    @Query('roleId') roleId?: string,
  ) {
    const result = await this.adminService.findAllAdminsWithPagination({
      limit,
      page,
      search,
      sort_attr,
      sort,
      status,
      roleId,
    });
    return { message: 'Admin retrieved successfully', ...result };
  }

  @RequirePermissions('read:admin')
  @Get('admin/:id')
  async getAdminByIdFun(@Param('id') id: string) {
    const user = await this.adminService.getAdminProfileFun(id);
    if (!user) {
      return { success: false, message: 'Admin not found' };
    }
    return { success: true, data: user };
  }

  @RequirePermissions('update:admin')
  @Put('admin/:id')
  updateAdminDetailsFun(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.updateAdminDetailsFun(id, dto, authUser.id);
  }

  @RequirePermissions('update:admin')
  @Patch('admin/:id/status')
  @ApiOperation({
    summary: 'Enable / disable admin',
    description: 'Disabling ends all of their sessions immediately.',
  })
  updateAdminStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAdminStatusDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.updateAdminStatusFun(id, dto.status, authUser.id);
  }

  @RequirePermissions('update:admin')
  @Put('admin/:id/password')
  @ApiOperation({
    summary: "Set another admin's password",
    description: 'Also unlocks the account and ends all of their sessions.',
  })
  setAdminPassword(
    @Param('id') id: string,
    @Body() dto: AdminSetPasswordDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.setAdminPasswordFun(
      id,
      dto.newPassword,
      authUser.id,
    );
  }

  @RequirePermissions('update:admin')
  @Post('admin/:id/logoutAll')
  @ApiOperation({ summary: 'Force logout an admin from all devices' })
  forceLogout(@Param('id') id: string) {
    return this.authService.logoutAllSessions(id);
  }

  @RequirePermissions('delete:admin')
  @Delete('admin/:id')
  deleteAdminFun(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return this.adminService.deleteAdminFun(id, authUser.id);
  }

  @RequirePermissions('read:admin')
  @Get('admin/:id/permissions')
  getAdminPermissions(@Param('id') id: string) {
    return this.adminService.getAdminPermissionsMatrix(id);
  }

  @RequirePermissions('update:admin')
  @Put('admin/:id/permissions')
  updateAdminPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
    @AuthAdmin() authUser: any,
  ) {
    return this.adminService.updateAdminPermissionsFun(id, dto, authUser.id);
  }

  @RequirePermissions('read:login_history')
  @Get('loginHistory')
  @PaginationDecorator()
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiOperation({ summary: 'Login attempts of all admins' })
  async loginHistory(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
    @Query('success', new ParseBoolPipe({ optional: true }))
    success?: boolean,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.authService.findLoginHistory({
      limit,
      page,
      search,
      userId,
      success,
      startDate,
      endDate,
    });
    return { success: true, ...result };
  }
}

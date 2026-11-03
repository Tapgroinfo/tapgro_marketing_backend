import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { AdminLoginDto } from './dto/AdminLogin.dto';
import { AdminCreateDto } from './dto/AdminCreateDto';
import { AdminService } from './admin.service';
import { JwtOnAuthGuard } from './guards/jwt-guard';
import { AuthAdmin } from './decorators/adminAuth.decorator';
import { UpdateAdminPasswordDto } from './dto/UpdateAdminPasswordDto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { UpdateAdminProfileDto } from './dto/UpdateAdminProfileDto';
import { UpdateAdminDto } from './dto/UpdateAdminDto';
import { UpdateAdminPermissionsDto } from './dto/UpdateAdminPermissionsDto';
import { PaginationDecorator } from '../../utils/decorator/paginationDecorator';
import { Sort } from '../../utils/pagination';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../guards/permissions.decorator';

@ApiTags('Admins')
@ApiBearerAuth('backendBearerAuth')
@Controller('/api/backend/v1')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('adminLogin')
  async adminLoginServiceFun(@Body() adminLoginDto: AdminLoginDto) {
    return await this.adminService.adminLoginServiceFun(adminLoginDto);
  }

  @Post('refreshToken')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Use when access token expires (default 3h). Send stored refresh_token to get a new JWT without logging in again.',
  })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.adminService.refreshTokens(refreshTokenDto);
  }

  @UseGuards(JwtOnAuthGuard)
  @Post('adminLogout')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Clears refresh token on server so the session cannot be renewed. Client should also discard stored tokens.',
  })
  async adminLogout(@AuthAdmin() authUser: any) {
    return await this.adminService.adminLogout(authUser.id);
  }

  @UseGuards(JwtOnAuthGuard)
  @Get('adminProfile')
  async getAdminProfileFun(@AuthAdmin() authUser: any) {
    const admin = await this.adminService.getAdminProfileFun(authUser.id);
    if (!admin) {
      throw new UnauthorizedException({ message: 'Admin not found' });
    }
    return {
      success: true,
      data: admin,
    };
  }

  @UseGuards(JwtOnAuthGuard)
  @Put('adminProfile')
  async updateAdminProfileFun(
    @Body() updateAdminProfileDto: UpdateAdminProfileDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.adminService.updateAdminProfileFun(
      updateAdminProfileDto,
      authUser.id,
    );
  }

  @UseGuards(JwtOnAuthGuard)
  @Post('changePassword')
  async updateAdminPasswordFun(
    @Body() updateAdminPasswordDto: UpdateAdminPasswordDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.adminService.updateAdminPasswordFun(
      updateAdminPasswordDto,
      authUser.id,
    );
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('create:admin')
  @Post('adminCreate')
  async adminCreateServiceFun(
    @Body() adminCreateDto: AdminCreateDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.adminService.adminCreateServiceFun(
      adminCreateDto,
      authUser.id,
    );
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('read:admin')
  @Get('admins')
  @PaginationDecorator()
  @ApiQuery({ name: 'sort', required: false, enum: Sort })
  async getAllAdminsWithPagination(
    @Query('limit') limit?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('sort_attr') sort_attr?: string,
    @Query('sort') sort?: Sort,
  ) {
    const result = await this.adminService.findAllAdminsWithPagination({
      limit,
      page,
      search,
      sort_attr,
      sort,
    });
    return {
      message: 'Admin retrieved successfully',
      ...result,
    };
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('read:admin')
  @Get('admin/:id')
  async getAdminByIdFun(@Param('id') id: string) {
    const user = await this.adminService.getAdminProfileFun(id);
    if (!user) {
      return {
        success: false,
        message: 'Admin not found',
      };
    }
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('update:admin')
  @Put('admin/:id')
  async updateAdminDetailsFun(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.adminService.updateAdminDetailsFun(
      id,
      updateAdminDto,
      authUser.id,
    );
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('delete:admin')
  @Delete('admin/:id')
  async deleteAdminFun(@Param('id') id: string, @AuthAdmin() authUser: any) {
    return await this.adminService.deleteAdminFun(id, authUser.id);
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('read:admin')
  @Get('admin/:id/permissions')
  async getAdminPermissions(@Param('id') id: string) {
    return await this.adminService.getAdminPermissionsMatrix(id);
  }

  @UseGuards(JwtOnAuthGuard, PermissionsGuard)
  @RequirePermissions('update:admin')
  @Put('admin/:id/permissions')
  async updateAdminPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
    @AuthAdmin() authUser: any,
  ) {
    return await this.adminService.updateAdminPermissionsFun(
      id,
      dto,
      authUser.id,
    );
  }
}

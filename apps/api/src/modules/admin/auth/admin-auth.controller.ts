import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminJwtUser } from './admin-jwt.types';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminPhoneLoginDto } from './dto/admin-phone-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('phone')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập admin bằng số điện thoại và mật khẩu' })
  phone(@Body() dto: AdminPhoneLoginDto) {
    return this.adminAuthService.loginWithPhone(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Làm mới access + refresh token (admin)' })
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuthService.refreshTokens(dto);
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth('admin-access-token')
  @ApiOperation({ summary: 'Thông tin admin hiện tại' })
  me(@CurrentAdmin() jwt: AdminJwtUser) {
    return this.adminAuthService.getMe(jwt.adminId);
  }
}

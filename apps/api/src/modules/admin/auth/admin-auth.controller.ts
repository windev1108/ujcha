import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AdminJwtUser } from './admin-jwt.types';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminGoogleLoginDto } from './dto/admin-google-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminEmailLoginDto } from './dto/admin-email-login.dto';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) { }

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập admin bằng Google (idToken)' })
  @ApiResponse({ status: 200 })
  google(@Body() dto: AdminGoogleLoginDto) {
    return this.adminAuthService.loginWithGoogle(dto);
  }

  @Post('email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập admin bằng email và password' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  email(@Body() dto: AdminEmailLoginDto) {
    return this.adminAuthService.loginWithEmail(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Làm mới access + refresh token (admin)' })
  @ApiResponse({ status: 200 })
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

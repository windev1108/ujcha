import type { Request } from 'express';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { JwtAuthGuard } from './jwt.guard';
import type { JwtValidatedUser } from './jwt.strategy';
import { UserService } from '../user/user.service';

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  const ip = req.socket?.remoteAddress ?? req.ip;
  return ip && ip.length > 0 ? ip : 'unknown';
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('send-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Gửi OTP (đăng ký / quên mật khẩu)' })
  @ApiResponse({ status: 200, description: 'Đã chấp nhận yêu cầu' })
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) {
    const ip = getClientIp(req);
    await this.authService.sendOtp(dto.phone, ip);
    return { message: 'OK' };
  }

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng ký tài khoản (xác minh OTP + tạo user)' })
  @ApiResponse({ status: 200, description: '{ user, accessToken, refreshToken }' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ip = getClientIp(req);
    return this.authService.register(dto.phone, dto.name, dto.password, dto.code, {
      deviceId: dto.deviceId,
      ipAddress: ip,
      refCode: dto.refCode,
    });
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập bằng số điện thoại + mật khẩu' })
  @ApiResponse({ status: 200, description: '{ user, accessToken, refreshToken }' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = getClientIp(req);
    return this.authService.loginWithPassword(dto.phone, dto.password, {
      deviceId: dto.deviceId,
      ipAddress: ip,
    });
  }

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập / đăng ký bằng Google (idToken)' })
  @ApiResponse({ status: 200, description: '{ user, accessToken, refreshToken }' })
  async google(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    const ip = getClientIp(req);
    return this.authService.loginWithGoogle(dto.idToken, {
      deviceId: dto.deviceId,
      ipAddress: ip,
      refCode: dto.refCode,
    });
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đặt lại mật khẩu qua OTP' })
  @ApiResponse({ status: 200, description: '{ message }' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.phone, dto.code, dto.newPassword);
    return { message: 'OK' };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Làm mới access token' })
  @ApiResponse({ status: 200, description: '{ accessToken }' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Thông tin user hiện tại (JWT)' })
  @ApiResponse({ status: 200, description: '{ user }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: Request & { user: JwtValidatedUser }) {
    const user = await this.userService.findById(req.user.userId);
    if (!user) {
      throw new NotFoundException({ message: 'Không tìm thấy user.', code: 'USER_NOT_FOUND' });
    }
    return { user };
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadAvatarDto } from './dto/upload-avatar.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy hồ sơ user hiện tại' })
  getProfile(@CurrentUserId() userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật tên / email / email marketing' })
  updateProfile(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @Get('avatar/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra user có thể upload avatar hôm nay không' })
  @ApiResponse({ status: 200, description: 'Có thể upload' })
  @ApiResponse({ status: 429, description: 'Đã upload hôm nay rồi' })
  async checkAvatarUpload(@CurrentUserId() userId: string) {
    await this.profileService.checkAvatarUploadAllowed(userId);
    return { ok: true };
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Lưu URL avatar sau khi đã upload lên Cloudinary' })
  @ApiResponse({ status: 429, description: 'Đã upload hôm nay rồi' })
  uploadAvatar(
    @CurrentUserId() userId: string,
    @Body() dto: UploadAvatarDto,
  ) {
    return this.profileService.uploadAvatar(userId, dto.url);
  }
}

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { UserService } from '../user/user.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'Không tìm thấy người dùng.', code: 'USER_NOT_FOUND' });
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const existing = await this.userService.findById(userId);
    if (!existing) {
      throw new NotFoundException({ message: 'Không tìm thấy người dùng.', code: 'USER_NOT_FOUND' });
    }

    const data: Partial<Pick<User, 'name' | 'email' | 'emailMarketingEnabled'>> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.emailMarketingEnabled !== undefined) data.emailMarketingEnabled = dto.emailMarketingEnabled;

    if (Object.keys(data).length === 0) return existing;
    return this.userService.updateUser(userId, data);
  }

  async uploadAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException({ message: 'Không tìm thấy người dùng.', code: 'USER_NOT_FOUND' });
    }

    // Daily limit: 1 upload per calendar day (UTC)
    if (user.lastAvatarUploadAt) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      if (user.lastAvatarUploadAt >= todayStart) {
        throw new HttpException(
          { message: 'Bạn chỉ có thể cập nhật ảnh đại diện 1 lần mỗi ngày.', code: 'AVATAR_DAILY_LIMIT' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    if (cloudName && !avatarUrl.startsWith(`https://res.cloudinary.com/${cloudName}/`)) {
      throw new BadRequestException({ message: 'URL ảnh không hợp lệ.', code: 'INVALID_AVATAR_URL' });
    }

    return this.userService.updateUser(userId, {
      avatar: avatarUrl,
      lastAvatarUploadAt: new Date(),
    });
  }
}

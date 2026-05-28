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

  async uploadAvatar(userId: string, imageBase64: string): Promise<User> {
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
    const uploadPreset = this.config.get<string>('CLOUDINARY_UPLOAD_PRESET');

    let avatarUrl: string;

    if (!cloudName || !uploadPreset) {
      // Dev fallback: store base64 directly
      avatarUrl = imageBase64;
    } else {
      avatarUrl = await this.uploadToCloudinary(imageBase64, cloudName, uploadPreset);
    }

    return this.userService.updateUser(userId, {
      avatar: avatarUrl,
      lastAvatarUploadAt: new Date(),
    });
  }

  private async uploadToCloudinary(
    imageBase64: string,
    cloudName: string,
    uploadPreset: string,
  ): Promise<string> {
    const body = new URLSearchParams();
    body.set('file', imageBase64);
    body.set('upload_preset', uploadPreset);
    body.set('folder', 'kun/avatars');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException({ message: 'Upload ảnh thất bại. Vui lòng thử lại.', detail: text });
    }

    const json = (await res.json()) as { secure_url?: string };
    if (!json.secure_url) {
      throw new BadRequestException({ message: 'Cloudinary không trả về URL ảnh.' });
    }
    return json.secure_url;
  }
}

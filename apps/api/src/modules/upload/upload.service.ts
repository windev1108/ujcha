import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CHAT_TEMP_FOLDER = 'chat-temp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async uploadTempImage(buffer: Buffer, _filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: CHAT_TEMP_FOLDER,
          tags: ['chat-temp'],
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              new BadRequestException({
                message: 'Tải ảnh lên thất bại.',
                code: 'CHAT_IMAGE_UPLOAD_FAILED',
              }),
            );
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }

  /** Trích public_id từ chính secure_url do uploadTempImage() trả về. */
  private extractPublicId(url: string): string | null {
    const match = url.match(
      /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/,
    );
    return match ? match[1] : null;
  }

  /** Xoá hàng loạt ảnh chat trên Cloudinary — gọi khi đóng phòng chat. */
  async deleteByUrls(urls: string[]): Promise<void> {
    const publicIds = urls
      .filter((u) => typeof u === 'string' && u.includes('res.cloudinary.com'))
      .map((u) => this.extractPublicId(u))
      .filter((id): id is string => !!id);

    if (publicIds.length === 0) return;

    for (let i = 0; i < publicIds.length; i += 100) {
      const batch = publicIds.slice(i, i + 100);
      try {
        await cloudinary.api.delete_resources(batch);
      } catch (err) {
        this.logger.error(`Xoá ảnh chat trên Cloudinary thất bại: ${err}`);
      }
    }
  }
}

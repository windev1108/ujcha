import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { UploadApiOptions, v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 15_000, // idle timeout của socket, giữ lại như lớp phụ
});

const HARD_TIMEOUT_MS = 20_000; // tổng thời gian tối đa cho 1 lần upload

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly CHAT_TEMP_FOLDER = 'chat-temp';
  private readonly CHAT_STICKER_FOLDER = 'chat-stickers';

  /** Upload buffer lên Cloudinary, luôn kết thúc (resolve/reject) trong HARD_TIMEOUT_MS. */
  private uploadBuffer(
    buffer: Buffer,
    options: UploadApiOptions,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: NodeJS.Timeout;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image', ...options },
        (error, result) => {
          if (error || !result) {
            const e = error as
              | { http_code?: number; message?: string }
              | undefined;
            this.logger.error(
              `Cloudinary upload lỗi: http=${e?.http_code} msg=${e?.message}`,
            );
            return finish(() => reject(this.mapError(e)));
          }
          finish(() => resolve(result.secure_url));
        },
      );

      // Cắt cứng nếu Cloudinary im lặng hoặc callback không bao giờ được gọi
      timer = setTimeout(() => {
        this.logger.error(
          `Cloudinary upload quá ${HARD_TIMEOUT_MS}ms, huỷ stream`,
        );
        stream.destroy();
        finish(() =>
          reject(
            new GatewayTimeoutException({
              message: 'Tải ảnh quá lâu, vui lòng thử lại.',
              code: 'UPLOAD_TIMEOUT',
            }),
          ),
        );
      }, HARD_TIMEOUT_MS);

      stream.on('error', (err) => {
        this.logger.error(`Cloudinary stream error: ${err?.message}`);
        finish(() => reject(this.mapError({ message: err?.message })));
      });

      stream.end(buffer);
    });
  }

  private mapError(e?: { http_code?: number; message?: string }) {
    if (e?.http_code === 499 || /timeout/i.test(e?.message ?? '')) {
      return new GatewayTimeoutException({
        message: 'Tải ảnh quá lâu, vui lòng thử lại.',
        code: 'UPLOAD_TIMEOUT',
      });
    }
    if (/file size too large|too large/i.test(e?.message ?? '')) {
      return new PayloadTooLargeException({
        message: 'Ảnh quá lớn.',
        code: 'IMAGE_TOO_LARGE',
      });
    }
    return new BadGatewayException({
      message: 'Tải ảnh lên thất bại, vui lòng thử lại.',
      code: 'UPLOAD_FAILED',
    });
  }

  async uploadTempImage(buffer: Buffer, _filename: string): Promise<string> {
    return this.uploadBuffer(buffer, {
      folder: this.CHAT_TEMP_FOLDER,
      tags: ['chat-temp'],
      // Giảm dung lượng lưu và tải cho người xem chat (áp dụng lúc upload)
      transformation: [
        { width: 1600, height: 1600, crop: 'limit', quality: 'auto' },
      ],
    });
  }

  async uploadStickerImage(buffer: Buffer, _filename: string): Promise<string> {
    return this.uploadBuffer(buffer, {
      folder: this.CHAT_STICKER_FOLDER,
      tags: ['chat-sticker'],
    });
  }

  /** Trích public_id từ chính secure_url do uploadTempImage() trả về. */
  private extractPublicId(url: string): string | null {
    const match = url.match(
      /\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?((?:chat-temp|chat-stickers)\/.+)\.[a-zA-Z0-9]+(?:\?.*)?$/,
    );
    return match ? match[1] : null;
  }

  /** Xoá hàng loạt ảnh chat trên Cloudinary, gọi khi đóng phòng chat. */
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const TEXTBEE_BASE = 'https://api.textbee.dev/api/v1';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `[UjCha] Mã OTP của bạn là: ${code}. Có hiệu lực trong 2 phút. Không chia sẻ mã này.`;
    const apiKey = this.config.get<string>('TEXTBEE_API_KEY');
    const deviceId = this.config.get<string>('TEXTBEE_DEVICE_ID');

    if (!apiKey || !deviceId) {
      this.logger.warn(`[SMS-MOCK] → ${phone} | OTP: ${code}`);
      await this.prisma.smsLog.create({
        data: { phone, message, status: 'mock' },
      });
      return;
    }

    let textbeeId: string | undefined;
    let status = 'sent';
    let error: string | undefined;

    try {
      const res = await fetch(
        `${TEXTBEE_BASE}/gateway/devices/${deviceId}/send-sms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ recipients: [phone], message }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const json = (await res.json()) as { data?: { _id?: string } };
      textbeeId = json.data?._id;
    } catch (err: unknown) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SMS] Gửi thất bại → ${phone}: ${error}`);
    }

    await this.prisma.smsLog.create({
      data: { phone, message, textbeeId, status, error },
    });
  }

  async listLogs(page: number, limit: number, phone?: string) {
    const where = phone ? { phone: { contains: phone } } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.smsLog.count({ where }),
    ]);
    return { items, total };
  }
}

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
    // ASCII-only to stay in 1 segment (160 chars)
    const message = `[UjCha] OTP code: ${code}.`;
    await this.sendRaw(phone, message);
  }

  async sendCredentials(phone: string, password: string): Promise<void> {
    // ASCII-only → 160 chars/segment, keeps cost at 1 segment
    const message = `[UjCha] Phone: ${phone} | Password: ${password}`;
    await this.sendRaw(phone, message);
  }

  private async sendRaw(phone: string, message: string): Promise<void> {
    const apiKey = this.config.get<string>('TEXTBEE_API_KEY');
    const deviceId = this.config.get<string>('TEXTBEE_DEVICE_ID');

    if (!apiKey || !deviceId) {
      this.logger.warn(`[SMS-MOCK] → ${phone} | ${message}`);
      await this.prisma.smsLog.create({ data: { phone, message, status: 'mock' } });
      return;
    }

    let textbeeId: string | undefined;
    let status = 'sent';
    let error: string | undefined;

    const t0 = Date.now();
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
      this.logger.log(`[SMS] textbee ack in ${Date.now() - t0}ms → id=${textbeeId ?? 'none'}`);
    } catch (err: unknown) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`[SMS] Failed in ${Date.now() - t0}ms → ${phone}: ${error}`);
    }

    await this.prisma.smsLog.create({ data: { phone, message, textbeeId, status, error } });
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

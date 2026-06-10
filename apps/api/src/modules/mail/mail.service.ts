import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface PromotionEmailData {
  subject: string;
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}

function buildHtml(data: PromotionEmailData, siteUrl: string): string {
  const cta =
    data.ctaText && data.ctaUrl
      ? `<div style="text-align:center;margin:32px 0;">
           <a href="${data.ctaUrl}"
              style="display:inline-block;background:#1a3c34;color:#ffffff;text-decoration:none;
                     padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;">
             ${data.ctaText}
           </a>
         </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#1a3c34;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">UjCha</span>
            <span style="color:#99d6b3;font-size:13px;font-weight:400;display:block;margin-top:4px;">
              Enjoy matcha your way.
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 8px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;line-height:1.3;">
              ${data.title}
            </h1>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-line;">
              ${data.body}
            </div>
            ${cta}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #ededed;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#717171;text-align:center;line-height:1.6;">
              Bạn nhận được email này vì đã đăng ký nhận thông báo khuyến mãi từ UjCha.<br>
              <a href="${siteUrl}/profile" style="color:#1a3c34;text-decoration:underline;">
                Huỷ đăng ký
              </a>
              &nbsp;·&nbsp;
              <a href="${siteUrl}" style="color:#1a3c34;text-decoration:underline;">ujcha.vn</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) { }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        secure: this.config.get('SMTP_PORT') === '465',
        auth: {
          user: this.config.getOrThrow<string>('SMTP_USER'),
          pass: this.config.getOrThrow<string>('SMTP_PASS'),
        },
      });
    }
    return this.transporter;
  }

  async sendPromotionEmail(to: string, data: PromotionEmailData): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM') ?? 'UjCha <noreply@ujcha.vn>';
    const siteUrl = this.config.get<string>('NEXT_PUBLIC_SITE_URL') ?? 'https://ujcha.vn';

    await this.getTransporter().sendMail({
      from,
      to,
      subject: data.subject,
      html: buildHtml(data, siteUrl),
    });
  }

  async sendPromotionBlast(data: PromotionEmailData): Promise<{ sent: number; failed: number }> {
    const users = await this.prisma.user.findMany({
      where: { emailMarketingEnabled: true, email: { not: null } },
      select: { email: true },
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await this.sendPromotionEmail(user.email!, data);
        sent++;
      } catch (err) {
        failed++;
        this.logger.error(`Failed to send to ${user.email}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Promotion blast done — sent: ${sent}, failed: ${failed}`);
    return { sent, failed };
  }
}

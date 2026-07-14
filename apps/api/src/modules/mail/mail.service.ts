import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface PromotionEmailData {
  subject: string;
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface NewOrderEmailData {
  orderId: string;
  paymentCode: string;
  type: string; // delivery | table | pickup
  customerName?: string | null;
  customerPhone?: string | null;
  coordinate: { lng: number; lat: number } | null;
  address?: string | null;
  totalAmount: Decimal;
  items: Array<{ name: string; quantity: number; price: Decimal }>;
}

function buildNewOrderHtml(data: NewOrderEmailData, siteUrl: string): string {
  const itemsRows = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ededed;font-size:14px;color:#1a1a1a;">
            ${item.name} × ${item.quantity}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #ededed;font-size:14px;color:#1a1a1a;text-align:right;">
            ${(Number(item.price) * item.quantity).toLocaleString('vi-VN')}đ
          </td>
        </tr>`,
    )
    .join('');

  const mapsUrl = data.coordinate
    ? `https://www.google.com/maps/search/?api=1&query=${data.coordinate.lat},${data.coordinate.lng}`
    : data.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`
      : null;

  const orderTypeLabel =
    data.type === 'delivery' ? 'Giao hàng' : data.type === 'table' ? 'Đặt bàn' : 'Mang đi';

  // Chuẩn hoá số điện thoại về dạng E.164 cho href="tel:" (giữ nguyên text hiển thị)
  const telHref = data.customerPhone
    ? `tel:${data.customerPhone.replace(/[^\d+]/g, '')}`
    : null;

  const infoBlock = `
    <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;">
      <tr>
        <td style="padding:2px 0;font-size:13px;color:#717171;width:90px;">Loại đơn</td>
        <td style="padding:2px 0;font-size:14px;color:#1a1a1a;font-weight:600;">${orderTypeLabel}</td>
      </tr>
      ${data.customerName
      ? `<tr>
               <td style="padding:2px 0;font-size:13px;color:#717171;">Khách hàng</td>
               <td style="padding:2px 0;font-size:14px;color:#1a1a1a;">${data.customerName}</td>
             </tr>`
      : ''
    }
      ${data.customerPhone
      ? `<tr>
               <td style="padding:2px 0;font-size:13px;color:#717171;">Điện thoại</td>
               <td style="padding:2px 0;font-size:14px;">
                 <a href="${telHref}" style="color:#1a3c34;text-decoration:underline;font-weight:600;">
                   📞 ${data.customerPhone}
                 </a>
               </td>
             </tr>`
      : ''
    }
    </table>`;

  const addressBlock = data.address
    ? `<p style="margin:0 0 8px;font-size:14px;color:#1a1a1a;">📍 ${data.address}</p>`
    : '';

  const mapsLink = mapsUrl
    ? `<p style="margin:0 0 20px;">
         <a href="${mapsUrl}" target="_blank"
            style="font-size:13px;color:#1a3c34;text-decoration:underline;font-weight:600;">
           🗺️ Xem vị trí trên Google Maps
         </a>
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1a3c34;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;">UjCha</span>
            <span style="color:#99d6b3;font-size:13px;display:block;margin-top:4px;">Đơn hàng mới</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 8px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a1a;">
              Đơn #${data.paymentCode}
            </h1>
            ${infoBlock}
            ${addressBlock}
            ${mapsLink}
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemsRows}
              <tr>
                <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;">Tổng cộng</td>
                <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1a1a1a;text-align:right;">
                  ${Number(data.totalAmount).toLocaleString('vi-VN')}đ
                </td>
              </tr>
            </table>
            <div style="text-align:center;margin:32px 0 8px;">
              <a href="${siteUrl}/orders/${data.orderId}"
                 style="display:inline-block;background:#1a3c34;color:#ffffff;text-decoration:none;
                        padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;">
                Xem đơn hàng
              </a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
              Matcha & More
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
  async sendNewOrderNotification(data: NewOrderEmailData): Promise<void> {
    const from =
      this.config.get<string>('SMTP_FROM') ?? 'UjCha <noreply@ujcha.vn>';
    const adminUrl =
      this.config.get<string>('ADMIN_SITE_URL') ?? 'https://ujcha.vn';
    const adminEmails = (
      this.config.get<string>('ADMIN_NOTIFICATION_EMAILS') ?? ''
    )
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      this.logger.warn(
        'ADMIN_NOTIFICATION_EMAILS chưa được cấu hình — bỏ qua gửi mail đơn mới',
      );
      return;
    }

    try {
      await this.getTransporter().sendMail({
        from,
        to: adminEmails.join(','),
        subject: `🔔 Đơn hàng mới #${data.paymentCode}`,
        html: buildNewOrderHtml(data, adminUrl),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send new-order notification: ${(err as Error).message}`,
      );
    }
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

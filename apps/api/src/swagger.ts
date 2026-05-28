import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const SWAGGER_PATH = 'docs';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('UjCha API')
    .setDescription('REST API UjCha — auth (OTP, Google, JWT), session, fraud.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token (Authorization: Bearer <token>)',
        in: 'header',
      },
      'access-token',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Admin JWT (Authorization: Bearer <token>)',
        in: 'header',
      },
      'admin-access-token',
    )
    .addTag('app', 'Root & health')
    .addTag('auth', 'OTP, Google, JWT, refresh')
    .addTag('profile', 'Hồ sơ user (JWT)')
    .addTag('addresses', 'Địa chỉ giao hàng (JWT)')
    .addTag('cart', 'Giỏ hàng (JWT)')
    .addTag('orders', 'Đơn hàng delivery / table / pickup (JWT)')
    .addTag('blog', 'Blog công khai (không auth)')
    .addTag('admin-auth', 'Đăng nhập & JWT admin')
    .addTag('admin-categories', 'Danh mục (admin JWT)')
    .addTag('admin-products', 'Sản phẩm (admin JWT)')
    .addTag('admin-orders', 'Đơn hàng (admin JWT)')
    .addTag('admin-tables', 'Bàn / QR (admin JWT)')
    .addTag('admin-shippers', 'Shipper (admin JWT)')
    .addTag('admin-payments', 'Thanh toán & webhook log (admin JWT)')
    .addTag('admin-referrals', 'Giới thiệu & reward (super_admin)')
    .addTag('admin-fraud-insights', 'Tín hiệu spam / IP / device (super_admin)')
    .addTag('admin-vouchers', 'Voucher (super_admin)')
    .addTag('admin-metrics', 'Thống kê dashboard (super_admin)')
    .addTag('admin-point-config', 'Cấu hình điểm & campaign (super_admin)')
    .addTag('admin-points', 'Điểm user & điều chỉnh thủ công (admin JWT)')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
    customSiteTitle: 'UjCha API — Swagger',
  });
}

export const swaggerDocsPath = `/${SWAGGER_PATH}`;

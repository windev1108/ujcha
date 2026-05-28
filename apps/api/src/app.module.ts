import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AddressModule } from './modules/address/address.module';
import { BlogModule } from './modules/blog/blog.module';
import { CartModule } from './modules/cart/cart.module';
import { EventsModule } from './modules/events/events.module';
import { OrderModule } from './modules/order/order.module';
import { PointModule } from './modules/point/point.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProfileModule } from './modules/profile/profile.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { ProductModule } from './modules/product/product.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { PosReleaseModule } from './modules/pos-release/pos-release.module';
import { PublicPaymentConfigModule } from './modules/public-payment-config/public-payment-config.module';
import { TableModule } from './modules/table/table.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { ReferralModule } from './modules/referral/referral.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GroupOrderModule } from './modules/group-order/group-order.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), 'apps', 'api', '.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    RedisModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    UserModule,
    AuthModule,
    ProfileModule,
    AddressModule,
    CartModule,
    OrderModule,
    BlogModule,
    PointModule,
    AdminModule,
    HealthModule,
    ProductModule,
    EventsModule,
    WebhookModule,
    FeedbackModule,
    PosReleaseModule,
    PublicPaymentConfigModule,
    TableModule,
    LoyaltyModule,
    VoucherModule,
    ReferralModule,
    ShippingModule,
    GroupOrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

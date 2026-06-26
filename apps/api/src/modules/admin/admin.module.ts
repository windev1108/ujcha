import { Module } from '@nestjs/common';
import { AdminAuthModule } from './auth/admin-auth.module';
import { HrmModule } from './hrm/hrm.module';
import { AdminCategoryModule } from './category/admin-category.module';
import { AdminFraudInsightsModule } from './fraud-insights/admin-fraud-insights.module';
import { AdminManagementModule } from './admin-management/admin-management.module';
import { AdminMetricsModule } from './metrics/admin-metrics.module';
import { AdminOverviewModule } from './overview/admin-overview.module';
import { AdminOrderModule } from './order/admin-order.module';
import { AdminPaymentModule } from './payment/admin-payment.module';
import { AdminPointModule } from './point/admin-point.module';
import { AdminPointConfigModule } from './point-config/admin-point-config.module';
import { AdminPostModule } from './post/admin-post.module';
import { AdminProductModule } from './product/admin-product.module';
import { AdminReferralModule } from './referral/admin-referral.module';
import { AdminShipperModule } from './shipper/admin-shipper.module';
import { AdminShopSettingsModule } from './shop-settings/admin-shop-settings.module';
import { AdminTableModule } from './table/admin-table.module';
import { AdminUserModule } from './user/admin-user.module';
import { AdminPaymentConfigModule } from './payment-config/admin-payment-config.module';
import { AdminVoucherModule } from './voucher/admin-voucher.module';
import { AdminTaxModule } from './tax/admin-tax.module';
import { AdminFeedbackModule } from './feedback/admin-feedback.module';
import { AdminSmsModule } from './sms/admin-sms.module';
import { ExternalOrderModule } from './external/external-order.module';
import { AdminShippingModule } from './shipping/admin-shipping.module';
import { AdminPointRewardModule } from './point-reward/admin-point-reward.module';
import { AdminGroupOrderModule } from './group-order/admin-group-order.module';
import { AdminStoreModule } from './store/admin-store.module';

@Module({
  imports: [
    AdminAuthModule,
    AdminCategoryModule,
    AdminProductModule,
    AdminUserModule,
    AdminManagementModule,
    AdminShopSettingsModule,
    AdminOrderModule,
    AdminTableModule,
    AdminShipperModule,
    AdminPaymentModule,
    AdminReferralModule,
    AdminFraudInsightsModule,
    AdminVoucherModule,
    AdminPostModule,
    AdminPointConfigModule,
    AdminPointModule,
    AdminMetricsModule,
    AdminOverviewModule,
    AdminPaymentConfigModule,
    AdminTaxModule,
    AdminFeedbackModule,
    AdminSmsModule,
    HrmModule,
    ExternalOrderModule,
    AdminShippingModule,
    AdminPointRewardModule,
    AdminGroupOrderModule,
    AdminStoreModule,
  ],
  exports: [
    AdminAuthModule,
    AdminCategoryModule,
    AdminProductModule,
    AdminOrderModule,
    AdminTableModule,
    AdminShipperModule,
    AdminPaymentModule,
    AdminReferralModule,
    AdminFraudInsightsModule,
    AdminVoucherModule,
    AdminMetricsModule,
    AdminOverviewModule,
    AdminPointConfigModule,
    AdminPointModule,
    AdminUserModule,
    AdminManagementModule,
    AdminPaymentConfigModule,
  ],
})
export class AdminModule { }

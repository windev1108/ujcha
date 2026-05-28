import { BadRequestException } from '@nestjs/common';
import { Prisma, VoucherDiscountType } from '@prisma/client';

export type VoucherRuleInput = {
  discountType: VoucherDiscountType;
  discountValue: Prisma.Decimal | number | string;
  minOrderAmount: Prisma.Decimal | number | string;
  maxDiscountAmount?: Prisma.Decimal | number | string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  perUserLimit: number;
};

export function assertVoucherRules(input: VoucherRuleInput): void {
  const dv = new Prisma.Decimal(input.discountValue.toString());
  const minOrd = new Prisma.Decimal(input.minOrderAmount.toString());

  if (minOrd.lessThan(0)) {
    throw new BadRequestException({
      message: 'minOrderAmount không được âm.',
      code: 'VOUCHER_MIN_ORDER_NEGATIVE',
    });
  }

  if (input.discountType === VoucherDiscountType.percent) {
    if (dv.lessThanOrEqualTo(0) || dv.greaterThan(100)) {
      throw new BadRequestException({
        message: 'Giảm % phải trong khoảng (0, 100].',
        code: 'VOUCHER_PERCENT_RANGE',
      });
    }
  } else {
    if (dv.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        message: 'Giảm số tiền phải lớn hơn 0.',
        code: 'VOUCHER_FIXED_NOT_POSITIVE',
      });
    }
  }

  if (input.maxDiscountAmount != null && input.maxDiscountAmount !== undefined) {
    const max = new Prisma.Decimal(input.maxDiscountAmount.toString());
    if (max.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        message: 'maxDiscountAmount phải lớn hơn 0 khi có.',
        code: 'VOUCHER_MAX_DISCOUNT_INVALID',
      });
    }
  }

  if (input.startsAt && input.endsAt) {
    if (input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw new BadRequestException({
        message: 'endsAt phải sau startsAt.',
        code: 'VOUCHER_DATE_RANGE',
      });
    }
  }

  if (input.usageLimit != null && input.usageLimit < 1) {
    throw new BadRequestException({
      message: 'usageLimit phải >= 1 khi có.',
      code: 'VOUCHER_USAGE_LIMIT',
    });
  }

  if (input.perUserLimit < 1) {
    throw new BadRequestException({
      message: 'perUserLimit phải >= 1.',
      code: 'VOUCHER_PER_USER_LIMIT',
    });
  }
}

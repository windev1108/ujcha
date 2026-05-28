import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';

const CONFIG_ID = 'default';

@Injectable()
export class AdminPaymentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.ensureRow();
  }

  async update(dto: UpdatePaymentConfigDto) {
    return this.prisma.paymentConfig.upsert({
      where: { id: CONFIG_ID },
      create: {
        id: CONFIG_ID,
        bankCode: dto.bankCode ?? '',
        accountNumber: dto.accountNumber ?? '',
        accountName: dto.accountName ?? '',
        sePayApiKey: dto.sePayApiKey ?? '',
        isEnabled: dto.isEnabled ?? false,
      },
      update: {
        ...(dto.bankCode !== undefined && { bankCode: dto.bankCode }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber }),
        ...(dto.accountName !== undefined && { accountName: dto.accountName }),
        ...(dto.sePayApiKey !== undefined && { sePayApiKey: dto.sePayApiKey }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });
  }

  private async ensureRow() {
    return this.prisma.paymentConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID },
      update: {},
    });
  }
}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminTaxController } from './admin-tax.controller';
import { AdminTaxService } from './admin-tax.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminTaxController],
  providers: [AdminTaxService],
  exports: [AdminTaxService],
})
export class AdminTaxModule {}

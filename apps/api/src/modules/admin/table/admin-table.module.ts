import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminTableController } from './admin-table.controller';
import { AdminTableService } from './admin-table.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminTableController],
  providers: [AdminTableService],
})
export class AdminTableModule {}

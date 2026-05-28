import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { UserVoucherService } from './user-voucher.service';

@ApiTags('vouchers')
@Controller('vouchers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VoucherController {
  constructor(private readonly userVoucherService: UserVoucherService) {}

  @Get('my')
  @ApiOperation({ summary: 'Túi voucher cá nhân của user đang đăng nhập' })
  getMyVouchers(@CurrentUserId() userId: string) {
    return this.userVoucherService.getMyVouchers(userId);
  }
}

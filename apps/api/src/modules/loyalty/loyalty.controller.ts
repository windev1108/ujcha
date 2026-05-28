import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClaimPointsDto } from './dto/claim-points.dto';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('order/:paymentCode')
  @ApiOperation({ summary: 'Kiểm tra đơn hàng để tích điểm (public)' })
  getOrderInfo(@Param('paymentCode') paymentCode: string) {
    return this.loyaltyService.getOrderInfo(paymentCode.toUpperCase());
  }

  @Post('order/:paymentCode/claim')
  @ApiOperation({ summary: 'Tích điểm cho đơn hàng (public, cần userId)' })
  claimPoints(
    @Param('paymentCode') paymentCode: string,
    @Body() dto: ClaimPointsDto,
  ) {
    return this.loyaltyService.claimPoints(paymentCode.toUpperCase(), dto.userId);
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Tìm kiếm thành viên để tích điểm (public)' })
  searchUsers(@Query('q') q?: string) {
    return this.loyaltyService.searchUsers(q ?? '');
  }
}

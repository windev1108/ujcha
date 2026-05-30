import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ShipperAuthService } from './shipper-auth.service';
import { ShipperLoginDto } from './dto/shipper-login.dto';
import { ShipperRefreshDto } from './dto/shipper-refresh.dto';
import { ShipperJwtGuard } from './shipper-jwt.guard';
import { CurrentShipper } from './decorators/current-shipper.decorator';
import type { ShipperJwtUser } from './shipper-jwt.types';

@Controller('shipper-auth')
export class ShipperAuthController {
  constructor(private readonly service: ShipperAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: ShipperLoginDto) {
    return this.service.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: ShipperRefreshDto) {
    return this.service.refresh(dto);
  }

  @Get('me')
  @UseGuards(ShipperJwtGuard)
  getMe(@CurrentShipper() shipper: ShipperJwtUser) {
    return this.service.getMe(shipper.shipperId);
  }

  @Patch('phone')
  @UseGuards(ShipperJwtGuard)
  @HttpCode(HttpStatus.OK)
  updatePhone(
    @CurrentShipper() shipper: ShipperJwtUser,
    @Body() body: { phone: string },
  ) {
    return this.service.updatePhone(shipper.shipperId, body.phone ?? '');
  }
}

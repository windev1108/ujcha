import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ShipperJwtGuard } from '../shipper-auth/shipper-jwt.guard';
import { CurrentShipper } from '../shipper-auth/decorators/current-shipper.decorator';
import type { ShipperJwtUser } from '../shipper-auth/shipper-jwt.types';
import { TrackingService } from './tracking.service';
import { LocationUpdateDto } from './dto/location-update.dto';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Post('location')
  @UseGuards(ShipperJwtGuard)
  @HttpCode(HttpStatus.OK)
  async updateLocation(@CurrentShipper() shipper: ShipperJwtUser, @Body() dto: LocationUpdateDto) {
    dto.timestamp = dto.timestamp ?? Date.now();
    await this.service.updateLocation(shipper.shipperId, dto);
    return { ok: true };
  }

  @Get('shipper/:shipperId/location')
  getLocation(@Param('shipperId') shipperId: string) {
    return this.service.getLocation(shipperId);
  }

  @Get('shipper/:shipperId/status')
  async getStatus(@Param('shipperId') shipperId: string) {
    return { status: await this.service.getStatus(shipperId) };
  }
}

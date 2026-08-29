import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
  ) { }

  @Get('reverse')
  async reverse(
    @Query('lat') latParam: string,
    @Query('lon') lonParam: string,
    @Query('lang') langParam: string,
  ) {
    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      throw new BadRequestException(
        'lat and lon must be valid numbers',
      );
    }

    if (lat < -90 || lat > 90) {
      throw new BadRequestException(
        'lat must be between -90 and 90',
      );
    }

    if (lon < -180 || lon > 180) {
      throw new BadRequestException(
        'lon must be between -180 and 180',
      );
    }

    return this.locationService.reverseGeocode(
      lat,
      lon,
      langParam
    );
  }
}
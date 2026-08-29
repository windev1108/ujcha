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
  @Get('search')
   async search( 
    @Query('q') query: string, 
    @Query('viewbox') viewbox?: string, 
    @Query('bounded') bounded?: string, 
    @Query('countrycodes') countrycodes?: string, 
    @Query('limit') limitParam?: string, 
    @Query('accept-language') acceptLanguage?: string, ) 
    { 
      if (!query?.trim()) {
         throw new BadRequestException( 'q is required', );
         } 
         const limit = limitParam ? Number(limitParam) : 6;
          if ( !Number.isInteger(limit) || limit < 1 || limit > 10 ) { 
            throw new BadRequestException( 'limit must be between 1 and 10', ); 
          }
           return this.locationService.search({ 
            query: query.trim(), 
            viewbox, 
            bounded: bounded === '1', 
            countrycodes: countrycodes || 'vn', 
            limit, 
            acceptLanguage: acceptLanguage || 'vi', }); 
          }
}
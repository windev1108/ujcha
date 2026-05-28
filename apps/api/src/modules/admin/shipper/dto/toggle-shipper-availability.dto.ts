import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleShipperAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

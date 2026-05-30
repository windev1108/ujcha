import { IsString } from 'class-validator';

export class ShipperRefreshDto {
  @IsString()
  refreshToken!: string;
}

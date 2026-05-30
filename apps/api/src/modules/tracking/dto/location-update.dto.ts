import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class LocationUpdateDto {
  @IsUUID('4')
  orderId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsNumber()
  timestamp!: number;

  @IsOptional()
  @IsNumber()
  speed?: number;
}

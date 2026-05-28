import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsInt, IsString, Min, Max } from 'class-validator';

export class UpdateStoreLocationDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90) @Max(90)
  lat: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180) @Max(180)
  lng: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(10) @Max(5000)
  radiusMeters?: number;

  @ApiPropertyOptional({ description: 'Địa chỉ văn bản hiển thị cho khách' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ cửa hàng' })
  @IsOptional()
  @IsString()
  phone?: string;
}

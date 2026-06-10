import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SendBlastDto {
  @ApiProperty({ example: 'Ưu đãi cuối tuần — Giảm 20% toàn menu' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'Ưu đãi cuối tuần dành riêng cho bạn!' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Dịp cuối tuần này, UjCha giảm 20% toàn bộ menu matcha và cà phê.\nÁp dụng từ thứ 6 đến chủ nhật.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ example: 'Đặt ngay' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ctaText?: string;

  @ApiPropertyOptional({ example: 'https://ujcha.vn/menu' })
  @IsOptional()
  @IsUrl()
  ctaUrl?: string;
}

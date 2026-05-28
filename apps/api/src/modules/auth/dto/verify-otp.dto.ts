import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '84901234567' })
  @IsString()
  @MinLength(9)
  @MaxLength(16)
  @Matches(/^\+?[0-9]{9,15}$/)
  phone!: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code!: string;

  @ApiProperty({ description: 'Định danh thiết bị (client tự sinh, ổn định)' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  deviceId!: string;

  @ApiPropertyOptional({ description: 'Mã referral của người giới thiệu' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  refCode?: string;
}

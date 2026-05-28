import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token từ client' })
  @IsString()
  @MinLength(10)
  idToken!: string;

  @ApiProperty()
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

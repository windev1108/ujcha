import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '84901234567', description: 'Số điện thoại (9–15 chữ số)' })
  @IsString()
  @MinLength(9)
  @MaxLength(16)
  @Matches(/^\+?[0-9]{9,15}$/, {
    message: 'phone phải là số điện thoại hợp lệ (9–15 chữ số, có thể có +).',
  })
  phone!: string;

  @ApiPropertyOptional({ enum: ['register', 'reset'], description: 'Mục đích gửi OTP' })
  @IsOptional()
  @IsString()
  @IsIn(['register', 'reset'])
  purpose?: 'register' | 'reset';
}

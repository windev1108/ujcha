import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AdminRole } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: '0901234567' })
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Số điện thoại không hợp lệ.' })
  phone: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ enum: AdminRole, default: AdminRole.staff })
  @IsEnum(AdminRole)
  role: AdminRole;

  @ApiPropertyOptional({ example: 'securepass123', description: 'Để trống để tự sinh mật khẩu ngẫu nhiên.' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: 'Email tùy chọn.' })
  @IsOptional()
  @IsString()
  email?: string;
}

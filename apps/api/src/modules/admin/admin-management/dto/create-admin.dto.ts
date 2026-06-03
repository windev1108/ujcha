import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'staff@ujcha.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.staff })
  @IsEnum(AdminRole)
  role: AdminRole;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '123 Nguyễn Trãi, Q.1, TP.HCM' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}

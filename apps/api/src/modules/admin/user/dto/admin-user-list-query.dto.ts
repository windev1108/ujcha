import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên, SĐT, email' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  q?: string;
}

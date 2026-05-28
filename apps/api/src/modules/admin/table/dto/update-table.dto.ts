import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Tầng 2' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  area?: string;

  @ApiPropertyOptional({ description: 'Bật/tắt bàn' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTableDto {
  @ApiProperty({ example: 'Bàn 01' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Tầng 1', description: 'Khu vực / tầng' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  area?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ArrayMaxSize, MaxLength } from 'class-validator';

export class ReturningCheckDto {
  @ApiPropertyOptional({ type: [String], description: 'Danh sách số điện thoại cần kiểm tra' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  phones?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Danh sách userId cần kiểm tra' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  userIds?: string[];
}

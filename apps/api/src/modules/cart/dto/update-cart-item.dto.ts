import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, description: '0 = xóa dòng khỏi giỏ' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999_999)
  quantity!: number;

  @ApiPropertyOptional({ description: '{ [groupId]: value }' })
  @IsOptional()
  @IsObject()
  selectedOptions?: Record<string, string>;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { each: true })
  toppingIds?: string[];
}

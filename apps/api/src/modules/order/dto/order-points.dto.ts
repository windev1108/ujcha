import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class OrderPointsBodyDto {
  @ApiProperty({ description: 'Số điểm muốn dùng', example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointToUse!: number;
}

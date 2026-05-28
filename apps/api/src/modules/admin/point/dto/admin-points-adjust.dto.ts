import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AdminPointsAdjustDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({
    description: 'Dương: cộng điểm; âm: trừ (không được làm âm balance).',
    example: 50,
  })
  @Type(() => Number)
  @IsInt()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

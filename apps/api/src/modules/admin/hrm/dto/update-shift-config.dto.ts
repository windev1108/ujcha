import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateShiftConfigDto {
  @ApiProperty({ description: 'Giờ vào ca (phút từ 00:00). Ví dụ 480 = 08:00', example: 480 })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes: number;

  @ApiProperty({ description: 'Giờ tan ca (phút từ 00:00). Ví dụ 1020 = 17:00', example: 1020 })
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinutes: number;

  @ApiPropertyOptional({ description: 'Biên độ cho phép (phút)', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  toleranceMinutes?: number;
}

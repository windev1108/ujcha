import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateFaceProfileDto {
  @ApiProperty({ description: 'Face descriptor — 128-element Float32Array serialised as number[]' })
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  descriptor: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

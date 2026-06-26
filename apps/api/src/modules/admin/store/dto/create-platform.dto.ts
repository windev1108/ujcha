import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlatformDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsUrl()
  link: string;

  @ApiProperty()
  @IsUrl()
  thumbnailUrl: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['logo_and_text', 'logo_only'] })
  @IsIn(['logo_and_text', 'logo_only'])
  @IsOptional()
  displayMode?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(8)
  @IsOptional()
  logoWidth?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(8)
  @IsOptional()
  logoHeight?: number;
}

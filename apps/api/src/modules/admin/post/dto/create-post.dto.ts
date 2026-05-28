import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PostContentFormat,
  PostStatus,
  PostType,
} from '@prisma/client';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiProperty({
    description: 'Markdown hoặc HTML tùy contentFormat',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500_000)
  content!: string;

  @ApiProperty({ enum: PostContentFormat })
  @IsEnum(PostContentFormat)
  contentFormat!: PostContentFormat;

  @ApiPropertyOptional({ description: 'URL hoặc path ảnh đại diện' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  thumbnail?: string;

  @ApiProperty({ enum: PostType })
  @IsEnum(PostType)
  type!: PostType;

  @ApiPropertyOptional({ enum: PostStatus, default: 'draft' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

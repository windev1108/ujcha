import { AnnouncementFrequency, AnnouncementType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateAnnouncementDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(AnnouncementType) type?: AnnouncementType;
  @IsOptional()
  @IsEnum(AnnouncementFrequency)
  frequency?: AnnouncementFrequency;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) content?: string;
  @IsOptional() @IsString() @MaxLength(60) ctaLabel?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(\/(?!\/)|https?:\/\/)/, {
    message: 'ctaUrl phải bắt đầu bằng "/" hoặc "https://".',
  })
  ctaUrl?: string | null;
  @IsOptional() @IsISO8601() startsAt?: string | null;
  @IsOptional() @IsISO8601() endsAt?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^(\/(?!\/)|https:\/\/)/, {
    message: 'imageUrl phải bắt đầu bằng "/" hoặc "https://".',
  })
  imageUrl?: string | null;
}

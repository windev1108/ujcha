// sticker/dto/index.ts
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  ValidateNested,
} from 'class-validator';


export class CreateStickerAlbumDto {
  @IsString()
  name: string;
}

export class UpdateStickerAlbumDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReorderAlbumsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}

export class CreateStickerByUrlDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsUUID()
  albumId?: string;
}

export class UpdateStickerDto {
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsUUID() albumId?: string | null;
}

export class ReorderStickersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}

export class StickerChangeDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** null = bỏ khỏi album (IsOptional bỏ qua validate khi null) */
  @IsOptional()
  @IsUUID()
  albumId?: string | null;
}

export class BatchUpdateStickersDto {
  /** Toàn bộ id sticker theo thứ tự mới. Bỏ trống nếu không đổi thứ tự. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  order?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StickerChangeDto)
  changes?: StickerChangeDto[];
}
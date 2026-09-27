// sticker/dto/index.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
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

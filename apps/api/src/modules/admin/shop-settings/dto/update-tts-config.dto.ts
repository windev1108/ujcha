import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const VALID_VOICES = [
  'hn-leyen','hn-quynhanh','hn-thaochi','hn-thanhtung','hn-namkhanh',
  'hn-phuongtrang','hn-thanhha','hn-thanhphuong','hn-tienquan',
  'hue-maingoc','hue-baoquoc',
  'hcm-diemmy','hcm-thuydung','hcm-phuongly','hcm-minhquan','hcm-thuyduyen',
];

export class UpdateTtsConfigDto {
  @ApiPropertyOptional({ example: 'hcm-diemmy', description: 'Voice ID Viettel AI' })
  @IsString()
  @IsIn(VALID_VOICES)
  @IsOptional()
  voice?: string;

  @ApiPropertyOptional({ example: 1.0, description: 'Tốc độ đọc 0.5–2.0' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  @IsOptional()
  speed?: number;

  @ApiPropertyOptional({ example: 3, description: 'Return option: 1=URL stream, 2=Base64, 3=Binary MP3, 4=Download URL' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(4)
  @IsOptional()
  tts_return_option?: number;

  @ApiPropertyOptional({ example: false, description: 'Tắt bộ lọc từ ngữ' })
  @IsBoolean()
  @IsOptional()
  without_filter?: boolean;
}

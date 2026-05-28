import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdatePosReleaseDto {
  @ApiProperty({ example: '1.0.8', description: 'Phiên bản mới (semver)' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ example: 'https://drive.google.com/uc?export=download&id=XXX' })
  @IsUrl()
  downloadUrl: string;

  @ApiPropertyOptional({ example: '- Sửa lỗi đơn hàng trùng\n- Thêm tính năng X' })
  @IsString()
  @IsOptional()
  releaseNotes?: string;
}

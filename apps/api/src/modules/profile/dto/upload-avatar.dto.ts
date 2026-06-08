import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({ description: 'Cloudinary secure_url của avatar đã upload' })
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;
}

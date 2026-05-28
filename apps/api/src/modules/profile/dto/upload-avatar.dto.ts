import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({ description: 'Base64 data URL of the avatar image' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  image!: string;
}

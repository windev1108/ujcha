import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminRefreshDto {
  @ApiProperty({ description: 'JWT refresh token (admin)' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

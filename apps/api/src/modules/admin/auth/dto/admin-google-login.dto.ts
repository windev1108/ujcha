import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdminGoogleLoginDto {
  @ApiProperty({ description: 'Google ID token (credential) từ @react-oauth/google' })
  @IsString()
  @MinLength(10)
  idToken!: string;
}

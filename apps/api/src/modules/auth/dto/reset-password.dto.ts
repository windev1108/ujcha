import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '0901234567' })
  @IsString()
  @MinLength(9)
  @MaxLength(16)
  @Matches(/^\+?[0-9]{9,15}$/)
  phone!: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 chữ số' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @ApiProperty({ minLength: 6, maxLength: 64 })
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  newPassword!: string;
}

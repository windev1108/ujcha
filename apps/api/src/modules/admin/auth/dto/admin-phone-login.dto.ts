import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class AdminPhoneLoginDto {
  @ApiProperty({ example: '0901234567' })
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Số điện thoại không hợp lệ.' })
  phone: string;

  @ApiProperty({ example: 'supersecret' })
  @IsString()
  @MinLength(6)
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '0901234567' })
  @IsString()
  @MinLength(9)
  @MaxLength(16)
  @Matches(/^\+?[0-9]{9,15}$/)
  phone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password!: string;

  @ApiProperty({ description: 'Định danh thiết bị' })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  deviceId!: string;
}

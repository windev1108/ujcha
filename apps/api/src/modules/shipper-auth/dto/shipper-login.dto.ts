import { IsString, Matches, MinLength } from 'class-validator';

export class ShipperLoginDto {
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Số điện thoại không hợp lệ.' })
  phone!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

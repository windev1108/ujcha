import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Mật khẩu hiện tại (bắt buộc nếu tài khoản đã có mật khẩu)',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ description: 'Mật khẩu mới', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

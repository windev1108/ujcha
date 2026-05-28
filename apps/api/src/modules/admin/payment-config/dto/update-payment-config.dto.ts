import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentConfigDto {
  @ApiPropertyOptional({ example: 'Vietcombank', description: 'Mã ngân hàng theo SePay (vd: Vietcombank, MB, TCB…)' })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiPropertyOptional({ example: '040091601771', description: 'Số tài khoản nhận tiền' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'NGUYEN VAN A', description: 'Tên chủ tài khoản' })
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional({ description: 'API key SePay để xác minh webhook' })
  @IsString()
  @IsOptional()
  sePayApiKey?: string;

  @ApiPropertyOptional({ description: 'Bật/tắt thanh toán QR' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isEnabled?: boolean;
}

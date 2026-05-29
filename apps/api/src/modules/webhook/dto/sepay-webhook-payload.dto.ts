import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class SepayWebhookPayloadDto {
  @ApiProperty({ example: 92704, description: 'ID giao dịch trên SePay' })
  @IsNumber()
  id!: number;

  @ApiProperty({ example: 'Vietcombank', description: 'Brand name ngân hàng' })
  @IsString()
  gateway!: string;

  @ApiProperty({ example: '2023-03-25 14:02:37', description: 'Thời gian giao dịch phía ngân hàng' })
  @IsString()
  transactionDate!: string;

  @ApiProperty({ example: '040091601771', description: 'Số tài khoản ngân hàng' })
  @IsString()
  accountNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  code?: string | null;

  @ApiProperty({ example: 'chuyen tien don hang UJCHA-ABC', description: 'Nội dung chuyển khoản' })
  @IsString()
  content!: string;

  @ApiProperty({ example: 'in', enum: ['in', 'out'], description: 'in = tiền vào, out = tiền ra' })
  @IsIn(['in', 'out'])
  transferType!: 'in' | 'out';

  @ApiProperty({ example: 2277000 })
  @IsNumber()
  transferAmount!: number;

  @ApiProperty({ example: 19077000, description: 'Số dư lũy kế' })
  @IsNumber()
  accumulated!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  subAccount?: string | null;

  @ApiPropertyOptional({ example: 'MBVCB.3278907687' })
  @IsString()
  @IsOptional()
  referenceCode?: string;

  @ApiPropertyOptional({ description: 'Toàn bộ nội dung tin nhắn SMS' })
  @IsString()
  @IsOptional()
  description?: string;
}

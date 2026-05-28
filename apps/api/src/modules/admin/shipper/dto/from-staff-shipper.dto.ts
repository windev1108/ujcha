import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class FromStaffShipperDto {
  @ApiProperty({ description: 'ID của tài khoản staff' })
  @IsUUID()
  adminId!: string;
}

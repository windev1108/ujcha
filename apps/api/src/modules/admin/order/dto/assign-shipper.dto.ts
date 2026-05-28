import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignShipperDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shipperId!: string;
}

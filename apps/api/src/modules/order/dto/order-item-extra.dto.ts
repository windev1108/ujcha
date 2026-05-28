import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class OrderItemExtraDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  toppingId!: string;
}

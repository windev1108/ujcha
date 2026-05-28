import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdatePermissionsDto {
  @ApiProperty({ type: [String], example: ['orders', 'tables'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

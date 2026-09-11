// src/modules/admin/store/dto/update-store-status.dto.ts
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StoreOperationStatus } from '@prisma/client';

export class UpdateStoreStatusDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  openMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  closeMinutes?: number;

  @IsOptional()
  @IsEnum(StoreOperationStatus)
  status?: StoreOperationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  statusReason?: string;
}

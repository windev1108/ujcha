import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGroupOrderDto {
  @IsEnum(['delivery', 'pickup', 'table'])
  type: string;

  @IsEnum(['host_pays', 'split'])
  paymentMode: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  pickupTime?: string;

  @IsOptional()
  @IsNumber()
  shippingFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class JoinGroupOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}

export class GroupOrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  quantity: number;

  @IsOptional()
  selectedOptions?: Record<string, string>;

  @IsOptional()
  toppings?: Array<{ toppingId: string; name: string; price: number }>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class AdminUpdateStatusDto {
  @IsEnum(['collecting', 'locked', 'completed', 'cancelled'])
  status: string;
}

export class UpdateItemsDto {
  @IsString()
  sessionToken: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupOrderItemDto)
  items: GroupOrderItemDto[];
}

export class SessionActionDto {
  @IsString()
  sessionToken: string;
}

export class PaymentActionDto {
  @IsString()
  sessionToken: string;

  @IsEnum(['cash', 'bank_transfer'])
  paymentType: string;
}

export class ConfirmPaidDto {
  @IsString()
  sessionToken: string;

  @IsUUID()
  participantId: string;
}

export class SetFulfillmentDto {
  @IsString()
  sessionToken: string;

  @IsEnum(['delivery', 'pickup', 'table'])
  type: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  pickupTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsEnum(['cash', 'bank_transfer'])
  paymentType?: string;

  @IsOptional()
  @IsEnum(['split', 'host_pays'])
  shippingFeeMode?: string;
}

export class DiscountTierDto {
  @IsInt()
  @Min(2)
  minParticipants: number;

  @IsNumber()
  @Min(0)
  discountPercent: number;
}

export class KickParticipantDto {
  @IsString()
  sessionToken: string;

  @IsUUID()
  participantId: string;
}

export class UpdateGroupOrderConfigDto {
  @IsOptional()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  expiryMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountTierDto)
  discountTiers?: DiscountTierDto[];
}

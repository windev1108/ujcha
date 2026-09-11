import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';



export class RecipeResolveItemDto {
  @ApiProperty({
    description:
      'Khóa định danh item — trả về nguyên vẹn trong response để FE map lại (vd orderItem.id, hoặc itemKey của Grab)',
  })
  @IsString()
  @MaxLength(200)
  key: string;

  @ApiProperty({
    required: false,
    description: 'productId nội bộ — dùng cho đơn Ujcha',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    required: false,
    description: 'SKU sản phẩm — dùng để map đơn Grab, format GRAB-{itemID}',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    type: [String],
    description:
      'Danh sách nhãn đã chọn (size, đá, đường, topping…) để lọc công thức theo biến thể. Với Grab đây là tên các modifier.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  selectedLabels: string[];
}

export class ResolveRecipeBatchDto {
  @ApiProperty({ type: [RecipeResolveItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RecipeResolveItemDto)
  items: RecipeResolveItemDto[];
}
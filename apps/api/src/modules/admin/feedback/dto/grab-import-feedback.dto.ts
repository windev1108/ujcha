import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GrabReviewItemDto {
  @IsString()
  reviewID: string;

  @IsString()
  content: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  eaterName?: string;

  @IsOptional()
  @IsNumber()
  createdAt?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderedItemNames?: string[];
}

export class GrabImportFeedbackDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrabReviewItemDto)
  reviews: GrabReviewItemDto[];
}

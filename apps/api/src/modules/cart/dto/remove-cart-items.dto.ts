import { IsArray, IsUUID } from 'class-validator';

export class RemoveCartItemsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds!: string[];
}

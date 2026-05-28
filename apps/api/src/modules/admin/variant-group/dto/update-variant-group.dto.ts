import { PartialType } from '@nestjs/swagger';
import { CreateVariantGroupDto } from './create-variant-group.dto';

export class UpdateVariantGroupDto extends PartialType(CreateVariantGroupDto) {}

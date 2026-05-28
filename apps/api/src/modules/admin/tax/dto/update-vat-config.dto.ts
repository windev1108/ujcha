import { PartialType } from '@nestjs/swagger';
import { CreateVatConfigDto } from './create-vat-config.dto';

export class UpdateVatConfigDto extends PartialType(CreateVatConfigDto) {}

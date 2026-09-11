// topping/topping.controller.ts — PUBLIC, không guard
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ToppingService } from './topping.service';

@ApiTags('toppings')
@Controller('toppings')
export class ToppingController {
  constructor(private readonly toppingService: ToppingService) {}

  @Get('out-of-stock')
  @ApiOperation({
    summary: 'nameKey các topping đang hết hàng (global, cache 60s)',
  })
  async getOutOfStock() {
    return { names: await this.toppingService.getOutOfStockNameKeys() };
  }
}

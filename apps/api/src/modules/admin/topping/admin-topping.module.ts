import { Module } from '@nestjs/common';

import { AdminToppingController } from './admin-topping.controller';
import { AdminToppingService } from './admin-topping.service';

@Module({
  controllers: [AdminToppingController],
  providers: [AdminToppingService],
  exports: [AdminToppingService],
})
export class AdminToppingModule {}

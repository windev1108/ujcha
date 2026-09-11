import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ToppingService } from './topping.service';
import { ToppingController } from './topping.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ToppingController],
  providers: [ToppingService],
  exports: [ToppingService],
})
export class ToppingModule {}

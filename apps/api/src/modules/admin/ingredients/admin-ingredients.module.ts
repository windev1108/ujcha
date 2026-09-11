import { ProductService } from './../../product/product.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminIngredientController } from './admin-ingredient.controller';
import { AdminIngredientService } from './admin-ingredient.service';

@Module({
  imports: [PrismaModule, RedisModule, AdminAuthModule],
  controllers: [AdminIngredientController],
  providers: [AdminIngredientService, ProductService],
})
export class AdminIngredientsModule {}

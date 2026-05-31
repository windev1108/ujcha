import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CategoryController } from './category.controller';

@Module({
    imports: [PrismaModule, RedisModule, AuthModule],
    controllers: [ProductController, CategoryController],
    providers: [ProductService],
    exports: [ProductService],
})
export class ProductModule { }

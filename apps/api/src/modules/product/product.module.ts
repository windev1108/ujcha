import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CategoryController } from './category.controller';
import { ToppingController } from './topping.controller';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [ProductController, CategoryController, ToppingController],
    providers: [ProductService],
})
export class ProductModule { }

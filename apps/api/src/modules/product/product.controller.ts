import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Query,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { ProductService } from './product.service';

@ApiTags('products')
@Controller('/products')
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    @Get()
    @ApiOperation({ summary: 'Danh sách sản phẩm' })
    @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
    @ApiQuery({ name: 'categorySlug', required: false })
    @ApiQuery({ name: 'q', required: false, description: 'Tìm theo tên / SKU / mô tả' })
    list(
        @Query('categoryId', new ParseUUIDPipe({ optional: true })) categoryId?: string,
        @Query('categorySlug') categorySlug?: string,
        @Query('q') q?: string,
    ) {
        return this.productService.list(categoryId, categorySlug, q);
    }

    @Get('by-slug/:slug')
    @ApiOperation({ summary: 'Tìm sản phẩm theo slug' })
    getBySlug(@Param('slug') slug: string) {
        return this.productService.getBySlug(slug);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Chi tiết sản phẩm' })
    getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.productService.getById(id);
    }
}

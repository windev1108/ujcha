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
    @ApiQuery({ name: 'locale', required: false, description: 'vi | en — trả về tên theo ngôn ngữ' })
    list(
        @Query('categoryId', new ParseUUIDPipe({ optional: true })) categoryId?: string,
        @Query('categorySlug') categorySlug?: string,
        @Query('q') q?: string,
        @Query('locale') locale?: string,
    ) {
        return this.productService.list(categoryId, categorySlug, q, locale);
    }


    @Get('best-sellers')
    @ApiOperation({ summary: 'Top sản phẩm bán chạy (sort theo lượt bán, tie-break isBestSeller)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Mặc định 12' })
    @ApiQuery({ name: 'locale', required: false, description: 'vi | en' })
    async bestSellers(
        @Query('limit') limit?: string,
        @Query('locale') locale?: string,
    ) {
        const n = Number(limit);
        const take = Number.isFinite(n) && n > 0 && n <= 50 ? n : 12;
        return this.productService.bestSellers(take, locale);
    }

    @Get('by-slug/:slug')
    @ApiOperation({ summary: 'Tìm sản phẩm theo slug' })
    @ApiQuery({ name: 'locale', required: false })
    getBySlug(
        @Param('slug') slug: string,
        @Query('locale') locale?: string,
    ) {
        return this.productService.getBySlug(slug, locale);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Chi tiết sản phẩm' })
    @ApiQuery({ name: 'locale', required: false })
    getById(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('locale') locale?: string,
    ) {
        return this.productService.getById(id, locale);
    }
}

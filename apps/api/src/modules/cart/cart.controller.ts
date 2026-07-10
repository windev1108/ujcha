import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveCartItemsDto } from './dto/remove-cart-items.dto';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) { }

  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng (null nếu chưa từng thêm)' })
  getCart(@CurrentUserId() userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Thêm / cộng dồn sản phẩm' })
  @ApiResponse({ status: 201 })
  addToCart(@CurrentUserId() userId: string, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(userId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Cập nhật số lượng / tuỳ chọn / topping (quantity=0 = xóa dòng)' })
  @ApiResponse({ status: 200 })
  updateItem(
    @CurrentUserId() userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa một dòng khỏi giỏ' })
  @ApiResponse({ status: 204 })
  async removeItem(
    @CurrentUserId() userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.cartService.removeItem(userId, itemId);
  }

  @Delete('items')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa nhiều dòng cùng lúc (sau checkout)' })
  @ApiResponse({ status: 204 })
  async removeItems(
    @CurrentUserId() userId: string,
    @Body() dto: RemoveCartItemsDto,
  ) {
    await this.cartService.removeItems(userId, dto.itemIds);
  }
}

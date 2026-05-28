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
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('addresses')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo địa chỉ (địa chỉ đầu tiên luôn là mặc định)' })
  @ApiResponse({ status: 201, description: 'Đã tạo' })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressService.createAddress(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách địa chỉ của user' })
  list(@CurrentUserId() userId: string) {
    return this.addressService.getUserAddresses(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật địa chỉ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.updateAddress(userId, id, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Đặt địa chỉ mặc định' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  setDefault(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.addressService.setDefaultAddress(userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa địa chỉ' })
  @ApiResponse({ status: 204, description: 'Đã xóa' })
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.addressService.deleteAddress(userId, id);
  }
}

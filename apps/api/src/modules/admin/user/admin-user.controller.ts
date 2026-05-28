import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserService } from '../../user/user.service';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AdminCustomerListQueryDto } from './dto/admin-customer-list-query.dto';

@ApiTags('admin-users')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Tìm khách (User) — không phải tài khoản Admin',
    description:
      'Truy vấn bảng `User` (khách app). Dùng khi tạo đơn / gắn SĐT khách.',
  })
  search(@Query() query: AdminUserListQueryDto) {
    return this.userService.searchCustomersForAdmin(query.q);
  }

  @Get('customers')
  @ApiOperation({
    summary: 'Danh sách khách hàng có phân trang',
    description: 'Dành cho trang quản trị user — tab Khách hàng.',
  })
  listCustomers(@Query() query: AdminCustomerListQueryDto) {
    return this.userService.listCustomersPaginated({
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':userId/addresses')
  @ApiOperation({
    summary: 'Địa chỉ giao của khách (User)',
    description: '`userId` là id bảng `User`, không phải `Admin`.',
  })
  listAddresses(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userService.listCustomerAddressesForAdmin(userId);
  }
}

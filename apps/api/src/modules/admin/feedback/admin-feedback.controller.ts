import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFeedbackService } from './admin-feedback.service';
import { BulkPinFeedbackDto } from './dto/bulk-pin-feedback.dto';
import { GrabImportFeedbackDto } from './dto/grab-import-feedback.dto';

@ApiTags('admin-feedback')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private readonly service: AdminFeedbackService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê phản hồi' })
  stats() {
    return this.service.stats();
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách phản hồi khách hàng (phân trang)' })
  list(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 20,
    @Query('rating', new ParseIntPipe({ optional: true })) rating?: number,
  ) {
    return this.service.list(Math.max(1, page), Math.min(100, pageSize), rating);
  }

  @Get('grab-imported-ids')
  @ApiOperation({ summary: 'Danh sách reviewID GrabFood đã import' })
  grabImportedIds() {
    return this.service.grabImportedIds();
  }

  @Post('bulk-pin')
  @ApiOperation({ summary: 'Ghim / bỏ ghim nhiều phản hồi cùng lúc' })
  bulkPin(@Body() dto: BulkPinFeedbackDto) {
    return this.service.bulkPin(dto.ids, dto.pin);
  }

  @Post('grab-import')
  @ApiOperation({ summary: 'Import đánh giá từ GrabFood' })
  grabImport(@Body() dto: GrabImportFeedbackDto) {
    return this.service.grabImport(dto.reviews);
  }

  @Post(':id/pin')
  @ApiOperation({ summary: 'Toggle pin/unpin phản hồi cho showcase' })
  pinToggle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.pinToggle(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa phản hồi' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(id);
  }
}

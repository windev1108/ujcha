import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/auth/admin-jwt.guard';
import { Roles } from '../admin/auth/decorators/roles.decorator';
import { RolesGuard } from '../admin/auth/guards/roles.guard';
import { SendBlastDto } from './dto/send-blast.dto';
import { MailService } from './mail.service';

@ApiTags('admin-mail')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('blast')
  @ApiOperation({ summary: 'Gửi email khuyến mãi đến tất cả user đã subscribe' })
  sendBlast(@Body() dto: SendBlastDto) {
    return this.mailService.sendPromotionBlast(dto);
  }
}

import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('pinned')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá được ghim cho showcase' })
  pinned() {
    return this.feedbackService.findPinned();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Gửi phản hồi từ khách hàng' })
  create(@Body() dto: CreateFeedbackDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
      req.socket?.remoteAddress ??
      null;
    return this.feedbackService.create(dto, ip);
  }
}

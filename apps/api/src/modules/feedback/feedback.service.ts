import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto, ip: string | null) {
    if (ip) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await this.prisma.feedback.findFirst({
        where: { ip, createdAt: { gte: today } },
        select: { id: true },
      });
      if (existing) {
        throw new HttpException(
          'Bạn đã gửi phản hồi hôm nay. Vui lòng thử lại vào ngày mai.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return this.prisma.feedback.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        content: dto.content,
        rating: dto.rating,
        ip,
      },
    });
  }
}

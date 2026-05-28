import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number, rating?: number) {
    const skip = (page - 1) * pageSize;
    const where = rating != null ? { rating } : {};
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, agg, ratingCounts] = await Promise.all([
      this.prisma.feedback.count(),
      this.prisma.feedback.count({ where: { createdAt: { gte: today } } }),
      this.prisma.feedback.aggregate({ _avg: { rating: true } }),
      this.prisma.feedback.groupBy({
        by: ['rating'],
        _count: { rating: true },
        where: { rating: { not: null } },
      }),
    ]);

    const byRating: Record<number, number> = {};
    for (const r of ratingCounts) {
      if (r.rating != null) byRating[r.rating] = r._count.rating;
    }

    return {
      total,
      todayCount,
      avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      byRating,
    };
  }

  async remove(id: string) {
    const exists = await this.prisma.feedback.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Không tìm thấy phản hồi.');
    await this.prisma.feedback.delete({ where: { id } });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  imageUrls: true,
} as const;

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
        include: { linkedProduct: { select: PRODUCT_SELECT } },
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

  async pinToggle(id: string) {
    const fb = await this.prisma.feedback.findUnique({
      where: { id },
      select: { isPinned: true },
    });
    if (!fb) throw new NotFoundException('Không tìm thấy phản hồi.');
    return this.prisma.feedback.update({
      where: { id },
      data: { isPinned: !fb.isPinned },
      select: { id: true, isPinned: true },
    });
  }

  private async resolveProductId(grabNames: string[]): Promise<string | undefined> {
    for (const rawName of grabNames) {
      // 1. UjCha product name contains the grab item name (e.g. "Matcha Latte" ⊇ "Matcha Latte")
      let product = await this.prisma.product.findFirst({
        where: { name: { contains: rawName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (product) return product.id;

      // 2. Strip trailing size / variant: "Matcha Latte (L)" → "Matcha Latte", "Cà phê đen S" → "Cà phê đen"
      const cleaned = rawName
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/\s+[SMLsml]$/, '')
        .trim();
      if (cleaned && cleaned !== rawName) {
        product = await this.prisma.product.findFirst({
          where: { name: { contains: cleaned, mode: 'insensitive' } },
          select: { id: true },
        });
        if (product) return product.id;
      }

      // 3. Reverse: grab item name contains a UjCha product name
      //    e.g. grab says "UjCha Matcha Latte" but product is "Matcha Latte"
      const candidates = await this.prisma.product.findMany({
        select: { id: true, name: true },
        take: 200,
      });
      const lower = rawName.toLowerCase();
      for (const p of candidates) {
        if (p.name && lower.includes(p.name.toLowerCase())) {
          return p.id;
        }
      }
    }
    return undefined;
  }

  async bulkPin(ids: string[], pin: boolean) {
    const result = await this.prisma.feedback.updateMany({
      where: { id: { in: ids } },
      data: { isPinned: pin },
    });
    return { updated: result.count };
  }

  async grabImportedIds(): Promise<string[]> {
    const rows = await this.prisma.feedback.findMany({
      where: { externalId: { startsWith: 'grab:' } },
      select: { externalId: true },
    });
    return rows.map((r) => r.externalId!.slice('grab:'.length));
  }

  async grabImport(
    reviews: {
      reviewID: string;
      content: string;
      rating: number;
      eaterName?: string;
      createdAt?: number;
      orderedItemNames?: string[];
    }[],
  ) {
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of reviews) {
      const externalId = `grab:${r.reviewID}`;
      try {
        const exists = await this.prisma.feedback.findUnique({
          where: { externalId },
          select: { id: true },
        });
        if (exists) {
          skipped++;
          continue;
        }

        // Try to resolve a linked product from ordered item names
        let linkedProductId: string | undefined;
        if (r.orderedItemNames && r.orderedItemNames.length > 0) {
          linkedProductId = await this.resolveProductId(r.orderedItemNames);
        }

        await this.prisma.feedback.create({
          data: {
            name: r.eaterName || null,
            content: r.content,
            rating: r.rating,
            externalId,
            ...(linkedProductId ? { linkedProductId } : {}),
            ...(r.createdAt
              ? { createdAt: new Date(r.createdAt * 1000) }
              : {}),
          },
        });
        imported++;
      } catch {
        failed++;
        errors.push(r.reviewID);
      }
    }

    return { imported, skipped, failed, errors };
  }
}

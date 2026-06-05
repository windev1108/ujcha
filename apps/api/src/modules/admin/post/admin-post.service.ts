import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { slugify, uniqueSlugSuffix } from '../slug.util';
import type { AdminPostListQueryDto } from './dto/admin-post-list-query.dto';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostDto } from './dto/update-post.dto';

const authorInclude = {
  author: { select: { id: true, email: true, role: true } },
} as const;

@Injectable()
export class AdminPostService {
  private readonly logger = new Logger(AdminPostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async findAll(query: AdminPostListQueryDto) {
    const usePageMode = query.page != null || query.pageSize != null;
    const pageSize = Math.min(query.pageSize ?? 10, 50);
    const page = Math.max(1, query.page ?? 1);
    const legacyTake = Math.min(query.limit ?? 50, 100);
    const legacySkip = query.skip ?? 0;

    const take = usePageMode ? pageSize : legacyTake;
    const skip = usePageMode ? (page - 1) * pageSize : legacySkip;

    const where: Prisma.PostWhereInput = {
      ...(query.status !== undefined && { status: query.status }),
      ...(query.type !== undefined && { type: query.type }),
      ...(query.q?.trim() && {
        title: { contains: query.q.trim(), mode: 'insensitive' },
      }),
    };

    const orderBy: Prisma.PostOrderByWithRelationInput =
      query.sort === 'oldest'
        ? { createdAt: 'asc' }
        : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy,
        take,
        skip,
        include: authorInclude,
      }),
      this.prisma.post.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / take));

    return {
      items,
      total,
      page: usePageMode ? page : Math.min(totalPages, Math.floor(skip / take) + 1),
      pageSize: take,
      totalPages,
    };
  }

  async findById(id: string) {
    const row = await this.prisma.post.findUnique({
      where: { id },
      include: authorInclude,
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy bài viết.',
        code: 'POST_NOT_FOUND',
      });
    }
    return row;
  }

  async create(authorId: string, dto: CreatePostDto) {
    const base = slugify(dto.title);
    const slug = await this.allocSlug(base);
    const status = dto.status ?? PostStatus.draft;
    const publishedAt =
      status === PostStatus.published ? new Date() : null;

    const post = await this.prisma.post.create({
      data: {
        title: dto.title.trim(),
        slug,
        content: dto.content,
        contentFormat: dto.contentFormat,
        thumbnail: dto.thumbnail?.trim() || null,
        type: dto.type,
        status,
        authorId,
        publishedAt,
      },
      include: authorInclude,
    });

    if (status === PostStatus.published) {
      void this.notifyNewPost(post).catch((err) => this.logger.error(err));
    }

    return post;
  }

  async update(id: string, dto: UpdatePostDto) {
    const existing = await this.findById(id);

    let slug = existing.slug;
    if (dto.title !== undefined && dto.title.trim() !== existing.title) {
      slug = await this.allocSlug(slugify(dto.title.trim()), id);
    }

    const nextStatus = dto.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (dto.status !== undefined) {
      if (nextStatus === PostStatus.published) {
        publishedAt =
          existing.status === PostStatus.draft
            ? new Date()
            : (existing.publishedAt ?? new Date());
      } else {
        publishedAt = null;
      }
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(slug !== existing.slug && { slug }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.contentFormat !== undefined && {
          contentFormat: dto.contentFormat,
        }),
        ...(dto.thumbnail !== undefined && {
          thumbnail: dto.thumbnail?.trim() || null,
        }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && {
          status: nextStatus,
          publishedAt,
        }),
      },
      include: authorInclude,
    });

    if (
      existing.status !== PostStatus.published &&
      nextStatus === PostStatus.published
    ) {
      void this.notifyNewPost(updated).catch((err) => this.logger.error(err));
    }

    return updated;
  }

  async publish(id: string) {
    await this.findById(id);
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.published,
        publishedAt: new Date(),
      },
      include: authorInclude,
    });
    void this.notifyNewPost(updated).catch((err) => this.logger.error(err));
    return updated;
  }

  async unpublish(id: string) {
    await this.findById(id);
    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.draft,
        publishedAt: null,
      },
      include: authorInclude,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.post.delete({ where: { id } });
  }

  private async notifyNewPost(post: { id: string; title: string; slug: string }) {
    await this.notificationService.createAndBroadcastToAll({
      type: 'news',
      title: `Bài viết mới: ${post.title}`,
      content: 'UjCha vừa đăng bài mới. Đọc ngay nhé!',
      data: { postId: post.id, slug: post.slug },
    });
  }

  private async allocSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base;
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.post.findFirst({
        where: {
          slug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${uniqueSlugSuffix()}`;
    }
    throw new BadRequestException({
      message: 'Không tạo được slug duy nhất.',
      code: 'POST_SLUG_COLLISION',
    });
  }
}

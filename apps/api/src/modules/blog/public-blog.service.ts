import { Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicPostsQueryDto } from './dto/public-posts-query.dto';

const listSelect = {
  id: true,
  title: true,
  slug: true,
  thumbnail: true,
  type: true,
  contentFormat: true,
  publishedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class PublicBlogService {
  constructor(private readonly prisma: PrismaService) { }

  async getPublishedPosts(query: PublicPostsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = {
      status: PostStatus.published,
      ...(query.type !== undefined && { type: query.type }),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        select: listSelect,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async getPostBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        status: PostStatus.published,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        contentFormat: true,
        thumbnail: true,
        type: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!post) {
      throw new NotFoundException({
        message: 'Không tìm thấy bài viết.',
        code: 'BLOG_POST_NOT_FOUND',
      });
    }

    return post;
  }
}

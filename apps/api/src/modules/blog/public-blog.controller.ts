import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicPostsQueryDto } from './dto/public-posts-query.dto';
import { PublicBlogService } from './public-blog.service';

@ApiTags('blog')
@Controller('blog')
export class PublicBlogController {
  constructor(private readonly publicBlogService: PublicBlogService) {}

  @Get('posts')
  @ApiOperation({
    summary: 'Danh sách bài đã xuất bản (publishedAt desc)',
  })
  getPublishedPosts(@Query() query: PublicPostsQueryDto) {
    return this.publicBlogService.getPublishedPosts(query);
  }

  @Get('posts/:slug')
  @ApiOperation({ summary: 'Chi tiết bài theo slug (chỉ published)' })
  getPostDetail(@Param('slug') slug: string) {
    return this.publicBlogService.getPostBySlug(slug);
  }
}

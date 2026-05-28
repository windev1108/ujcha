import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicBlogController } from './public-blog.controller';
import { PublicBlogService } from './public-blog.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicBlogController],
  providers: [PublicBlogService],
})
export class BlogModule {}

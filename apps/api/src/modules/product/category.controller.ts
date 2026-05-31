import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('categories')
@Controller('/categories')
export class CategoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách danh mục (public)' })
  @ApiQuery({ name: 'locale', required: false, description: 'vi | en — trả về tên theo ngôn ngữ' })
  async list(@Query('locale') locale?: string) {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        thumbnail: true,
        nameTranslation: true,
        _count: { select: { products: { where: { isAvailable: true } } } },
      },
    })

    if (!locale || locale === 'vi') return rows

    return rows.map(cat => {
      const nt = cat.nameTranslation as Record<string, string> | null
      const translated = nt?.[locale]?.trim()
      return translated ? { ...cat, name: translated } : cat
    })
  }
}

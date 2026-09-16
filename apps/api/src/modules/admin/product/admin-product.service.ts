import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { skuFromProductName, slugify, uniqueSlugSuffix } from '../slug.util';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ToggleProductAvailabilityDto } from './dto/toggle-product-availability.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import {
  buildScopeKey,
  clampDiscountPercent,
  computeFinalPrice,
  normalizeImageUrls,
  normalizeInlineOptionGroups,
  normalizeInlineToppings,
  normalizeTranslation,
} from '../../../helper/utils';
import { RedisService } from '../../redis/redis.service';
import { SetProductRecipeDto } from '../ingredients/dto/set-product-recipe.dto';
import { RecipeResolveItemDto } from './dto/resolve-recipe-batch.dto';

const GLOBAL_DISCOUNT_KEY = 'ujcha:shop:globalDiscount';
const GLOBAL_DISCOUNT_TTL = 60;

@Injectable()
export class AdminProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(categoryId?: string, categorySlug?: string, q?: string) {
    const qx = q?.trim();
    const [rows, globalDiscount] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          AND: [
            categoryId ? { categoryId } : {},
            categorySlug ? { category: { slug: categorySlug } } : {},
            qx
              ? {
                  OR: [
                    { name: { contains: qx, mode: 'insensitive' } },
                    { sku: { contains: qx, mode: 'insensitive' } },
                    { description: { contains: qx, mode: 'insensitive' } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ name: 'asc' }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.getGlobalDiscount(),
    ]);
    return rows.map((r) => normalizeProductRow(r, globalDiscount));
  }

  async getById(id: string) {
    const [row, globalDiscount] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id },
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.getGlobalDiscount(),
    ]);
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy sản phẩm.',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return normalizeProductRow(row, globalDiscount);
  }

  async create(dto: CreateProductDto) {
    const cat = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!cat) {
      throw new BadRequestException({
        message: 'Danh mục không tồn tại.',
        code: 'PRODUCT_CATEGORY_NOT_FOUND',
      });
    }

    const nameTrim = dto.name.trim();
    const skuNorm = await this.resolveSkuForCreate(dto.sku, nameTrim);
    const base = dto.slug?.trim() ? slugify(dto.slug) : slugify(nameTrim);
    const slug = await this.allocProductSlug(base);

    const imageUrls = normalizeImageUrls(dto.imageUrls);
    const optionGroups = normalizeInlineOptionGroups(dto.optionGroups);
    const toppings = normalizeInlineToppings(dto.toppings);
    const nameTranslation = normalizeTranslation(dto.nameTranslation);
    const descriptionTranslation = normalizeTranslation(
      dto.descriptionTranslation,
    );

    const created = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        sku: skuNorm,
        name: nameTrim,
        slug,
        description: dto.description?.trim() ?? null,
        price: new Prisma.Decimal(dto.price),
        imageUrls,
        optionGroups: optionGroups as unknown as Prisma.InputJsonValue,
        toppings: toppings as unknown as Prisma.InputJsonValue,
        nameTranslation: nameTranslation as unknown as Prisma.InputJsonValue,
        descriptionTranslation:
          descriptionTranslation as unknown as Prisma.InputJsonValue,
        isAvailable: dto.isAvailable ?? true,
        isSoldOut: dto.isSoldOut ?? false,
        isBestSeller: dto.isBestSeller ?? false,
        discountPercent: clampDiscountPercent(dto.discountPercent, 0),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.redis.delByPattern('ujcha:products:list:*');
    return normalizeProductRow(created, await this.getGlobalDiscount());
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.getById(id);

    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!cat) {
        throw new BadRequestException({
          message: 'Danh mục không tồn tại.',
          code: 'PRODUCT_CATEGORY_NOT_FOUND',
        });
      }
    }

    let skuNorm: string | undefined;
    if (dto.sku !== undefined) {
      const trimmed = dto.sku.trim();
      if (trimmed) {
        const skuTaken = await this.prisma.product.findFirst({
          where: { sku: trimmed, NOT: { id } },
          select: { id: true },
        });
        if (skuTaken) {
          throw new BadRequestException({
            message: 'SKU đã tồn tại.',
            code: 'PRODUCT_SKU_DUPLICATE',
          });
        }
        skuNorm = trimmed;
      } else {
        const nameForSku = dto.name?.trim() ?? existing.name;
        skuNorm = await this.allocUniqueSku(skuFromProductName(nameForSku), id);
      }
    }

    let slug: string | undefined;
    if (dto.slug !== undefined) {
      const base = slugify(dto.slug);
      slug = await this.allocProductSlug(base, id);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(skuNorm !== undefined && { sku: skuNorm }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(slug !== undefined && { slug }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
        ...(dto.imageUrls !== undefined && {
          imageUrls: normalizeImageUrls(dto.imageUrls),
        }),
        ...(dto.optionGroups !== undefined && {
          optionGroups: normalizeInlineOptionGroups(
            dto.optionGroups,
          ) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.toppings !== undefined && {
          toppings: normalizeInlineToppings(
            dto.toppings,
          ) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.nameTranslation !== undefined && {
          nameTranslation: normalizeTranslation(
            dto.nameTranslation,
          ) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.descriptionTranslation !== undefined && {
          descriptionTranslation: normalizeTranslation(
            dto.descriptionTranslation,
          ) as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
        ...(dto.isSoldOut !== undefined && { isSoldOut: dto.isSoldOut }),
        ...(dto.isBestSeller !== undefined && {
          isBestSeller: dto.isBestSeller,
        }),
        ...(dto.discountPercent !== undefined && {
          discountPercent: clampDiscountPercent(dto.discountPercent),
        }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.redis.delByPattern('ujcha:products:list:*');
    return normalizeProductRow(updated, await this.getGlobalDiscount());
  }

  async toggleAvailability(id: string, dto: ToggleProductAvailabilityDto) {
    await this.getById(id);
    const [row, globalDiscount] = await Promise.all([
      this.prisma.product.update({
        where: { id },
        data: { isAvailable: dto.isAvailable },
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.getGlobalDiscount(),
    ]);
    await this.redis.delByPattern('ujcha:products:list:*');
    return normalizeProductRow(row, globalDiscount);
  }

  async remove(id: string) {
    await this.getById(id);
    try {
      await this.prisma.product.delete({ where: { id } });
      await this.redis.delByPattern('ujcha:products:list:*');
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e?.code === 'P2003'
      ) {
        throw new BadRequestException({
          message: 'Không xóa được sản phẩm đang nằm trong giỏ hoặc đơn hàng.',
          code: 'PRODUCT_REFERENCED',
        });
      }
      throw e;
    }
  }

  private async resolveSkuForCreate(
    explicit: string | undefined,
    productName: string,
  ): Promise<string> {
    const trimmed = explicit?.trim();
    if (trimmed) {
      const skuTaken = await this.prisma.product.findFirst({
        where: { sku: trimmed },
        select: { id: true },
      });
      if (skuTaken) {
        throw new BadRequestException({
          message: 'SKU đã tồn tại.',
          code: 'PRODUCT_SKU_DUPLICATE',
        });
      }
      return trimmed;
    }
    const base = skuFromProductName(productName);
    return this.allocUniqueSku(base);
  }

  private async allocUniqueSku(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = (base || 'item').slice(0, 80);
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.product.findFirst({
        where: {
          sku: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      const suffix = uniqueSlugSuffix();
      const raw = `${base || 'item'}-${suffix}`;
      candidate = raw.slice(0, 80);
    }
    throw new BadRequestException({
      message: 'Không tạo được mã SKU duy nhất.',
      code: 'PRODUCT_SKU_COLLISION',
    });
  }

  private async allocProductSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let candidate = base;
    for (let i = 0; i < 12; i += 1) {
      const existing = await this.prisma.product.findFirst({
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
      message: 'Không tạo được slug duy nhất cho sản phẩm.',
      code: 'PRODUCT_SLUG_COLLISION',
    });
  }

  async getGlobalDiscount(): Promise<number> {
    const cached = await this.redis.get<number>(GLOBAL_DISCOUNT_KEY);
    if (cached !== null) return cached;
    const settings = await this.prisma.shopSettings.findFirst();
    const val = settings?.globalDiscountPercent ?? 0;
    await this.redis.set(GLOBAL_DISCOUNT_KEY, val, GLOBAL_DISCOUNT_TTL);
    return val;
  }
  async getRecipe(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, recipeNote: true },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Không tìm thấy sản phẩm.',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const [items, toppingItems] = await Promise.all([
      this.prisma.productRecipeItem.findMany({
        where: { productId },
        include: { ingredient: true },
        orderBy: [{ scopeKey: 'asc' }, { createdAt: 'asc' }], // đổi từ optionGroupName
      }),
      this.prisma.productToppingRecipeItem.findMany({
        where: { productId },
        include: { ingredient: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { recipeNote: product.recipeNote, items, toppingItems };
  }

  async setRecipe(productId: string, dto: SetProductRecipeDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Không tìm thấy sản phẩm.',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const optionGroups = (product.optionGroups as any[]) ?? [];
    const toppings = (product.toppings as any[]) ?? [];

    const seenScopeKeys = new Map<string, Set<string>>(); // ingredientId -> set of scopeKey, chặn trùng ở tầng service (fail sớm, đẹp hơn để DB unique bắt)

    for (const it of dto.items) {
      const conditions = it.conditions ?? [];

      // validate từng điều kiện phải khớp đúng option group + value đang tồn tại trên sản phẩm
      for (const c of conditions) {
        const group = optionGroups.find((g) => g.name === c.group);
        const valueExists = group?.values?.some(
          (v: any) => v.label === c.value,
        );
        if (!group || !valueExists) {
          throw new BadRequestException({
            message: `Biến thể "${c.group} / ${c.value}" không tồn tại trên sản phẩm.`,
            code: 'INVALID_RECIPE_VARIANT',
          });
        }
      }

      // chặn 2 dòng cùng ingredient trùng đúng 1 scope (trước khi đụng DB unique)
      const scopeKey = buildScopeKey(conditions);
      const set = seenScopeKeys.get(it.ingredientId) ?? new Set<string>();
      if (set.has(scopeKey)) {
        throw new BadRequestException({
          message:
            'Có 2 dòng công thức trùng điều kiện cho cùng 1 nguyên liệu.',
          code: 'DUPLICATE_RECIPE_SCOPE',
        });
      }
      set.add(scopeKey);
      seenScopeKeys.set(it.ingredientId, set);
    }

    for (const t of dto.toppingItems ?? []) {
      if (!toppings.some((tp: any) => tp.id === t.toppingId)) {
        throw new BadRequestException({
          message: 'Topping không tồn tại trên sản phẩm.',
          code: 'INVALID_RECIPE_TOPPING',
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { recipeNote: dto.recipeNote?.trim() || null },
      });
      await tx.productRecipeItem.deleteMany({ where: { productId } });
      await tx.productToppingRecipeItem.deleteMany({ where: { productId } });

      if (dto.items.length) {
        await tx.productRecipeItem.createMany({
          data: dto.items.map((i) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const conditions = i.conditions ?? [];
            return {
              productId,
              ingredientId: i.ingredientId,
              conditions: conditions as unknown as Prisma.InputJsonValue,
              scopeKey: buildScopeKey(conditions),
              quantity: new Prisma.Decimal(i.quantity),
            };
          }),
        });
      }

      if (dto.toppingItems?.length) {
        await tx.productToppingRecipeItem.createMany({
          data: dto.toppingItems.map((t) => ({
            productId,
            toppingId: t.toppingId,
            ingredientId: t.ingredientId,
            quantity: new Prisma.Decimal(t.quantity),
          })),
        });
      }

      return this.getRecipe(productId);
    });
  }

  async getStats(params: { from?: string; to?: string; limit?: number }) {
    const to = params.to ? new Date(params.to) : new Date();
    const from = params.from
      ? new Date(params.from)
      : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    const limit = params.limit ?? 10;

    const [items, totalOrders] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: {
          order: { paymentStatus: 'paid', createdAt: { gte: from, lte: to } },
        },
        select: {
          quantity: true,
          price: true,
          product: {
            select: {
              id: true,
              name: true,
              imageUrls: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.order.count({
        where: { paymentStatus: 'paid', createdAt: { gte: from, lte: to } },
      }),
    ]);

    type ProductAgg = {
      productId: string;
      name: string;
      imageUrl: string | null;
      quantitySold: number;
      revenue: number;
      categoryId: string;
      categoryName: string;
    };
    type CategoryAgg = {
      categoryId: string;
      categoryName: string;
      revenue: number;
      quantitySold: number;
    };

    const byProduct = new Map<string, ProductAgg>();
    const byCategory = new Map<string, CategoryAgg>();
    let totalRevenue = 0;
    let totalQuantitySold = 0;

    for (const it of items) {
      if (!it.product) continue;
      const lineRevenue = Number(it.price.toString()) * it.quantity;
      totalRevenue += lineRevenue;
      totalQuantitySold += it.quantity;

      const imgs = Array.isArray(it.product.imageUrls)
        ? (it.product.imageUrls as string[])
        : [];
      const p = byProduct.get(it.product.id);
      if (p) {
        p.quantitySold += it.quantity;
        p.revenue += lineRevenue;
      } else {
        byProduct.set(it.product.id, {
          productId: it.product.id,
          name: it.product.name,
          imageUrl: imgs[0] ?? null,
          quantitySold: it.quantity,
          revenue: lineRevenue,
          categoryId: it.product.category.id,
          categoryName: it.product.category.name,
        });
      }

      const c = byCategory.get(it.product.category.id);
      if (c) {
        c.revenue += lineRevenue;
        c.quantitySold += it.quantity;
      } else {
        byCategory.set(it.product.category.id, {
          categoryId: it.product.category.id,
          categoryName: it.product.category.name,
          revenue: lineRevenue,
          quantitySold: it.quantity,
        });
      }
    }

    const all = [...byProduct.values()];
    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        totalRevenue,
        totalQuantitySold,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        distinctProductsSold: byProduct.size,
      },
      topByQuantity: [...all]
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, limit),
      topByRevenue: [...all]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit),
      lowPerformers: [...all]
        .sort((a, b) => a.quantitySold - b.quantitySold)
        .slice(0, limit),
      categoryBreakdown: [...byCategory.values()].sort(
        (a, b) => b.revenue - a.revenue,
      ),
    };
  }

  async resolveRecipeBatch(items: RecipeResolveItemDto[]) {
    const productIds = [
      ...new Set(items.filter((i) => i.productId).map((i) => i.productId!)),
    ];
    const skus = [...new Set(items.filter((i) => i.sku).map((i) => i.sku!))];

    const products =
      productIds.length || skus.length
        ? await this.prisma.product.findMany({
            where: {
              OR: [
                ...(productIds.length ? [{ id: { in: productIds } }] : []),
                ...(skus.length ? [{ sku: { in: skus } }] : []),
              ],
            },
            select: {
              id: true,
              name: true,
              sku: true,
              optionGroups: true, // ← thêm: cần để suy default cho group bị thiếu
              toppings: true,
              recipeNote: true,
            },
          })
        : [];

    const byId = new Map(products.map((p) => [p.id, p]));
    const bySku = new Map(
      products.filter((p) => p.sku).map((p) => [p.sku as string, p]),
    );

    const relevantProductIds = products.map((p) => p.id);
    const [recipeItems, toppingRecipeItems] = relevantProductIds.length
      ? await Promise.all([
          this.prisma.productRecipeItem.findMany({
            where: { productId: { in: relevantProductIds } },
            include: { ingredient: true },
          }),
          this.prisma.productToppingRecipeItem.findMany({
            where: { productId: { in: relevantProductIds } },
            include: { ingredient: true },
          }),
        ])
      : [[], []];

    const normalize = (s: string) => s.trim().toLowerCase();

    // So khớp "Size L" (Grab gửi, đã rút gọn) với "Size L (700ml)" (admin định nghĩa đầy đủ)
    // mà KHÔNG khớp nhầm kiểu "Bình Thường" ⊂ "Đá Bình Thường" — chỉ chấp nhận nếu phần dư
    // bắt đầu bằng dấu cách hoặc dấu ngoặc, để tránh dính chữ liền nhau.
    const labelsEqual = (a: string, b: string): boolean => {
      if (a === b) return true;
      const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
      if (!shorter || !longer.startsWith(shorter)) return false;
      const rest = longer.slice(shorter.length);
      return rest === '' || rest.startsWith(' ') || rest.startsWith('(');
    };

    const matchLabel = (candidate: string, selectedNorm: string[]) => {
      const c = normalize(candidate);
      if (!c) return false;
      return selectedNorm.some((s) => labelsEqual(c, s));
    };

    // Điều kiện coi là khớp nếu MỌI condition.value đều match 1 label đã chọn (hoặc suy default)
    const conditionsMatch = (
      conditions: { group: string; value: string }[],
      selectedNorm: string[],
    ) => conditions.every((c) => matchLabel(c.value, selectedNorm));

    // Với các option group mà Grab KHÔNG gửi label lên (vì đang ở default),
    // tự bổ sung value mặc định của group đó vào danh sách để so khớp.
    const buildEffectiveSelectedNorm = (
      optionGroups: Array<{
        name: string;
        values: Array<{
          label: string;
          priceDelta?: number;
          isDefault?: boolean;
        }>;
      }>,
      selectedLabels: string[],
    ): string[] => {
      const selectedNorm = selectedLabels.map(normalize).filter(Boolean);
      const result = [...selectedNorm];

      for (const group of optionGroups ?? []) {
        const hasSelection = (group.values ?? []).some((v) =>
          selectedNorm.some((s) => labelsEqual(normalize(v.label), s)),
        );
        if (hasSelection) continue;

        const def =
          group.values?.find((v) => v.isDefault) ??
          group.values?.find((v) => (v.priceDelta ?? 0) === 0) ??
          group.values?.[0];
        if (def) result.push(normalize(def.label));
      }

      return result;
    };

    const result: Record<
      string,
      {
        matched: boolean;
        productId?: string;
        productName?: string;
        sku?: string | null;
        recipeNote?: string | null;
        items?: Array<{
          id: string;
          ingredientId: string;
          ingredientName: string;
          unit: string;
          quantity: string;
          conditions: { group: string; value: string }[];
        }>;
        toppingItems?: Array<{
          id: string;
          ingredientId: string;
          ingredientName: string;
          unit: string;
          quantity: string;
          toppingId: string;
          toppingName: string;
        }>;
      }
    > = {};

    for (const item of items) {
      const product = item.productId
        ? byId.get(item.productId)
        : item.sku
          ? bySku.get(item.sku)
          : undefined;

      if (!product) {
        result[item.key] = { matched: false };
        continue;
      }

      const optionGroups = (product.optionGroups as any[]) ?? [];
      const selectedNorm = buildEffectiveSelectedNorm(
        optionGroups,
        item.selectedLabels,
      );

      const productRecipes = recipeItems.filter(
        (ri) => ri.productId === product.id,
      );

      const bestByIngredient = new Map<
        string,
        (typeof productRecipes)[number] & { score: number }
      >();

      for (const ri of productRecipes) {
        const conditions =
          (ri.conditions as unknown as { group: string; value: string }[]) ??
          [];
        if (!conditionsMatch(conditions, selectedNorm)) continue;

        const score = conditions.length;
        const current = bestByIngredient.get(ri.ingredientId);
        if (!current || score > current.score) {
          bestByIngredient.set(ri.ingredientId, { ...ri, score });
        }
      }

      const matchedItems = [...bestByIngredient.values()];

      const toppingsArr =
        (product.toppings as Array<{ id: string; name: string }>) ?? [];
      const matchedToppingItems = toppingRecipeItems.filter((tri) => {
        if (tri.productId !== product.id) return false;
        const topping = toppingsArr.find((t) => t.id === tri.toppingId);
        if (!topping) return false;
        return matchLabel(topping.name, selectedNorm);
      });

      result[item.key] = {
        matched: true,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        recipeNote: product.recipeNote,
        items: matchedItems.map((mi) => ({
          id: mi.id,
          ingredientId: mi.ingredientId,
          ingredientName: mi.ingredient.name,
          unit: mi.ingredient.unit,
          quantity: mi.quantity.toString(),
          conditions:
            (mi.conditions as unknown as { group: string; value: string }[]) ??
            [],
        })),
        toppingItems: matchedToppingItems.map((mt) => ({
          id: mt.id,
          ingredientId: mt.ingredientId,
          ingredientName: mt.ingredient.name,
          unit: mt.ingredient.unit,
          quantity: mt.quantity.toString(),
          toppingId: mt.toppingId,
          toppingName:
            toppingsArr.find((t) => t.id === mt.toppingId)?.name ?? '',
        })),
      };
    }

    return result;
  }
}

function normalizeProductRow<
  T extends {
    price: unknown;
    discountPercent: number;
    optionGroups: unknown;
    toppings: unknown;
    nameTranslation: unknown;
    descriptionTranslation: unknown;
  },
>(row: T, globalDiscount = 0) {
  // Product-specific discount takes priority; global is the fallback when product has none
  const effectiveDiscount =
    row.discountPercent > 0 ? row.discountPercent : globalDiscount;
  return {
    ...row,
    // discountPercent stays as the RAW stored value so the admin editor can round-trip it without accumulation
    discountPercent: row.discountPercent,
    effectiveDiscountPercent: effectiveDiscount,
    globalDiscountPercent: globalDiscount,
    optionGroups: normalizeInlineOptionGroups(row.optionGroups as any),
    toppings: normalizeInlineToppings(row.toppings as any),
    nameTranslation: (row.nameTranslation &&
    typeof row.nameTranslation === 'object'
      ? row.nameTranslation
      : {}) as Record<string, string>,
    descriptionTranslation: (row.descriptionTranslation &&
    typeof row.descriptionTranslation === 'object'
      ? row.descriptionTranslation
      : {}) as Record<string, string>,
    finalPrice: computeFinalPrice(row.price, effectiveDiscount),
  };
}

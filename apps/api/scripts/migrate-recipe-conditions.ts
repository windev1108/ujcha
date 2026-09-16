// scripts/migrate-recipe-conditions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

function buildScopeKey(conditions: { group: string; value: string }[]): string {
  if (conditions.length === 0) return 'ALL';
  return [...conditions]
    .sort((a, b) => a.group.localeCompare(b.group))
    .map((c) => `${c.group}::${c.value}`)
    .join('|');
}

async function main() {
  let cursor: string | undefined;
  let migrated = 0;

  while (true) {
    const rows = await prisma.productRecipeItem.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;

    await prisma.$transaction(
      rows.map((r) => {
        const conditions =
          r.optionGroupName && r.optionValueLabel
            ? [{ group: r.optionGroupName, value: r.optionValueLabel }]
            : [];
        return prisma.productRecipeItem.update({
          where: { id: r.id },
          data: { conditions, scopeKey: buildScopeKey(conditions) },
        });
      }),
    );

    migrated += rows.length;
    cursor = rows[rows.length - 1].id;
    console.log(`Đã migrate ${migrated} dòng...`);
  }

  console.log('Hoàn tất.');
}

main().finally(() => prisma.$disconnect());
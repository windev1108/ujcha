import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.voucher.updateMany({
    where: { code: 'UJCHA-WELCOME' },
    data: { isWelcome: true, isActive: true },
  });
  console.log(`Updated ${result.count} voucher(s) → isWelcome=true`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

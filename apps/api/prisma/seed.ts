import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.ADMIN_SEED_PHONE;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME ?? 'Super Admin';

  if (!phone || !password) {
    console.log(
      'ℹ️  Bỏ qua seed admin: chưa đặt ADMIN_SEED_PHONE hoặc ADMIN_SEED_PASSWORD trong .env',
    );
    return;
  }

  const existing = await prisma.admin.findFirst({
    where: { role: AdminRole.super_admin },
    select: { id: true, phone: true, name: true },
  });

  if (existing) {
    console.log(`ℹ️  Super admin đã tồn tại: ${existing.phone ?? '(no phone)'} — ${existing.name}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.create({
    data: {
      phone,
      name,
      role: AdminRole.super_admin,
      password: passwordHash,
      isActive: true,
    },
  });

  console.log(`✅ Đã tạo super admin`);
  console.log(`   SĐT   : ${admin.phone}`);
  console.log(`   Tên   : ${admin.name}`);
  console.log(`   ID    : ${admin.id}`);
  console.log(`   (mật khẩu lấy từ ADMIN_SEED_PASSWORD trong .env)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });

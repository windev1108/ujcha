import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Supabase pgBouncer (transaction mode): default pool_timeout of 10s is too short
// under concurrent load. Append param if not already present; use string concat to
// avoid new URL() mis-encoding passwords that contain URL-special characters.
function buildDatasourceUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (!raw || raw.includes('pool_timeout')) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}pool_timeout=30`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({ datasources: { db: { url: buildDatasourceUrl() } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

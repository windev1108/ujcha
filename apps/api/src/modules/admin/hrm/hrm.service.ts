import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateStoreLocationDto } from './dto/update-store-location.dto';
import type { UpdateFaceProfileDto } from './dto/update-face-profile.dto';
import type { CheckinDto } from './dto/checkin.dto';
import type { AttendanceQueryDto } from './dto/attendance-query.dto';
import type { UpdateShiftConfigDto } from './dto/update-shift-config.dto';
import { AttendanceType } from '@prisma/client';

const VN_TZ = '+07:00';
function vnStartOfDay(d: string): Date { return new Date(`${d}T00:00:00${VN_TZ}`); }
function vnEndOfDay(d: string): Date { return new Date(`${d}T23:59:59.999${VN_TZ}`); }
function vnTodayStr(): string {
  const n = new Date(Date.now() + 7 * 3600_000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}
function vnDateStr(d: Date): string {
  const n = new Date(d.getTime() + 7 * 3600_000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

/** Haversine distance in metres between two lat/lng points. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Euclidean distance between two face descriptors. Match if < 0.6. */
function faceDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]!) ** 2, 0));
}

const FACE_THRESHOLD = 0.6;

/** Calculate total completed work minutes from an ordered list of attendance records. */
function calcTotalMinutes(records: { type: AttendanceType; createdAt: Date }[]): number {
  let total = 0;
  let lastCheckin: Date | null = null;
  for (const r of records) {
    if (r.type === AttendanceType.checkin) {
      lastCheckin = r.createdAt;
    } else if (r.type === AttendanceType.checkout && lastCheckin) {
      total += Math.round((r.createdAt.getTime() - lastCheckin.getTime()) / 60000);
      lastCheckin = null;
    }
  }
  return total;
}

@Injectable()
export class HrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Shift config ──────────────────────────────────────────────────

  async getShiftConfig() {
    const cfg = await this.prisma.shiftConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      return { id: 'default', startMinutes: 480, endMinutes: 1020, toleranceMinutes: 0, updatedAt: new Date().toISOString() };
    }
    return cfg;
  }

  async updateShiftConfig(dto: UpdateShiftConfigDto) {
    return this.prisma.shiftConfig.upsert({
      where: { id: 'default' },
      update: { startMinutes: dto.startMinutes, endMinutes: dto.endMinutes, toleranceMinutes: dto.toleranceMinutes ?? 0 },
      create: { id: 'default', startMinutes: dto.startMinutes, endMinutes: dto.endMinutes, toleranceMinutes: dto.toleranceMinutes ?? 0 },
    });
  }

  // ─── Store location ────────────────────────────────────────────────

  async getStoreLocation() {
    const loc = await this.prisma.storeLocation.findUnique({ where: { id: 'default' } });
    if (!loc) {
      return { id: 'default', lat: 0, lng: 0, radiusMeters: 100, address: '', updatedAt: new Date().toISOString() };
    }
    return loc;
  }

  async updateStoreLocation(dto: UpdateStoreLocationDto) {
    const payload = {
      lat: dto.lat,
      lng: dto.lng,
      radiusMeters: dto.radiusMeters ?? 100,
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
    };
    return this.prisma.storeLocation.upsert({
      where: { id: 'default' },
      update: payload,
      create: { id: 'default', ...payload },
    });
  }

  // ─── Face profile ──────────────────────────────────────────────────

  async getFaceProfile(adminId: string) {
    return this.prisma.staffFaceProfile.findUnique({ where: { adminId } });
  }

  async upsertFaceProfile(adminId: string, dto: UpdateFaceProfileDto) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId }, select: { id: true } });
    if (!admin) throw new NotFoundException({ message: 'Không tìm thấy nhân viên.', code: 'ADMIN_NOT_FOUND' });

    return this.prisma.staffFaceProfile.upsert({
      where: { adminId },
      update: { descriptorJson: dto.descriptor, imageUrl: dto.imageUrl ?? null },
      create: { adminId, descriptorJson: dto.descriptor, imageUrl: dto.imageUrl ?? null },
    });
  }

  // ─── Attendance ────────────────────────────────────────────────────

  async getMyTodayRecord(adminId: string) {
    const today = vnTodayStr();
    const records = await this.prisma.staffAttendance.findMany({
      where: {
        adminId,
        createdAt: { gte: vnStartOfDay(today), lte: vnEndOfDay(today) },
      },
      orderBy: { createdAt: 'asc' },
    });
    const lastRecord = records[records.length - 1] ?? null;
    return {
      records,
      lastType: lastRecord?.type ?? null,
      totalMinutes: calcTotalMinutes(records),
    };
  }

  async checkin(adminId: string, dto: CheckinDto) {
    // Allow multiple check-ins per day; rule: last record must not be a check-in
    const today = vnTodayStr();
    const lastRecord = await this.prisma.staffAttendance.findFirst({
      where: { adminId, createdAt: { gte: vnStartOfDay(today), lte: vnEndOfDay(today) } },
      orderBy: { createdAt: 'desc' },
    });
    if (lastRecord?.type === AttendanceType.checkin) {
      throw new BadRequestException({ message: 'Bạn đang trong ca làm việc. Hãy check-out trước.', code: 'ALREADY_CHECKED_IN' });
    }
    return this.createAttendance(adminId, AttendanceType.checkin, dto);
  }

  async checkout(adminId: string, dto: CheckinDto) {
    // Only allow checkout when last record today is a check-in
    const today = vnTodayStr();
    const lastRecord = await this.prisma.staffAttendance.findFirst({
      where: { adminId, createdAt: { gte: vnStartOfDay(today), lte: vnEndOfDay(today) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastRecord || lastRecord.type !== AttendanceType.checkin) {
      throw new BadRequestException({ message: 'Chưa check-in. Hãy check-in trước.', code: 'NOT_CHECKED_IN' });
    }
    return this.createAttendance(adminId, AttendanceType.checkout, dto);
  }

  private async createAttendance(adminId: string, type: AttendanceType, dto: CheckinDto) {
    // 1. Validate store location
    const loc = await this.prisma.storeLocation.findUnique({ where: { id: 'default' } });
    if (!loc || (loc.lat === 0 && loc.lng === 0)) {
      throw new BadRequestException({ message: 'Vị trí cửa hàng chưa được cấu hình.', code: 'STORE_LOCATION_NOT_SET' });
    }

    const dist = haversineMeters(dto.lat, dto.lng, loc.lat, loc.lng);
    if (dist > loc.radiusMeters) {
      throw new BadRequestException({
        message: `Bạn cách cửa hàng ${Math.round(dist)}m, vượt quá phạm vi cho phép ${loc.radiusMeters}m.`,
        code: 'OUT_OF_RANGE',
      });
    }

    // 2. Validate face against stored descriptor in DB
    const profile = await this.prisma.staffFaceProfile.findUnique({ where: { adminId } });
    if (!profile) {
      throw new BadRequestException({ message: 'Chưa đăng ký khuôn mặt. Liên hệ quản lý.', code: 'FACE_NOT_REGISTERED' });
    }

    const stored = profile.descriptorJson as number[];
    const fd = faceDistance(dto.descriptor, stored);
    if (fd > FACE_THRESHOLD) {
      throw new BadRequestException({ message: 'Không nhận diện được khuôn mặt.', code: 'FACE_MISMATCH' });
    }

    return this.prisma.staffAttendance.create({
      data: { adminId, type, lat: dto.lat, lng: dto.lng, distanceMeters: dist, faceDistance: fd },
    });
  }

  // ─── Admin list attendance (raw, for export/reference) ─────────────

  async listAttendance(query: AttendanceQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const today = vnTodayStr();
    const from = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const to = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);

    const where = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      createdAt: { gte: from, lte: to },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.staffAttendance.count({ where }),
      this.prisma.staffAttendance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { id: true, email: true, role: true, name: true } } },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  // ─── Admin daily summary (grouped by staff + date) ─────────────────

  async listDailySummary(query: AttendanceQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const today = vnTodayStr();
    const from = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const to = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);

    const where = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      createdAt: { gte: from, lte: to },
    };

    const records = await this.prisma.staffAttendance.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { admin: { select: { id: true, email: true, role: true, name: true } } },
    });

    // Fetch face profile image URLs for all admins in the result set
    const uniqueAdminIds = [...new Set(records.map((r) => r.adminId))];
    const faceProfiles = uniqueAdminIds.length > 0
      ? await this.prisma.staffFaceProfile.findMany({
          where: { adminId: { in: uniqueAdminIds } },
          select: { adminId: true, imageUrl: true },
        })
      : [];
    const faceImageMap = new Map(faceProfiles.map((p) => [p.adminId, p.imageUrl ?? null]));

    // Group by adminId + VN calendar date
    const groupMap = new Map<string, {
      adminId: string;
      date: string;
      admin: { id: string; email: string; role: string; name: string | null };
      records: typeof records;
    }>();

    for (const r of records) {
      const dateStr = vnDateStr(r.createdAt);
      const key = `${r.adminId}|${dateStr}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { adminId: r.adminId, date: dateStr, admin: r.admin, records: [] });
      }
      groupMap.get(key)!.records.push(r);
    }

    // Sort: date desc, then staff email asc
    const sorted = [...groupMap.values()].sort(
      (a, b) => b.date.localeCompare(a.date) || a.admin.email.localeCompare(b.admin.email),
    );

    const total = sorted.length;
    const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);

    const items = pageItems.map((g) => {
      const pairs: Array<{
        checkin: (typeof records)[0];
        checkout: (typeof records)[0] | null;
      }> = [];
      let lastCheckin: (typeof records)[0] | null = null;
      for (const r of g.records) {
        if (r.type === AttendanceType.checkin) {
          lastCheckin = r;
          pairs.push({ checkin: r, checkout: null });
        } else if (r.type === AttendanceType.checkout && lastCheckin) {
          pairs[pairs.length - 1]!.checkout = r;
          lastCheckin = null;
        }
      }
      return {
        adminId: g.adminId,
        date: g.date,
        admin: { ...g.admin, faceImageUrl: faceImageMap.get(g.adminId) ?? null },
        pairs,
        totalMinutes: calcTotalMinutes(g.records),
      };
    });

    return { items, total, page, pageSize };
  }

  async listStaffWithProfiles() {
    const [admins, profiles] = await this.prisma.$transaction([
      this.prisma.admin.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, role: true, name: true, phone: true, address: true, createdAt: true, permissions: true } }),
      this.prisma.staffFaceProfile.findMany({ select: { adminId: true, imageUrl: true, updatedAt: true } }),
    ]);
    const profileMap = new Map(profiles.map((p) => [p.adminId, p]));
    return admins.map((a) => ({ ...a, faceProfile: profileMap.get(a.id) ?? null }));
  }

  async getPermissions(staffId: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: staffId }, select: { id: true, permissions: true } });
    if (!admin) throw new NotFoundException({ message: 'Không tìm thấy nhân viên.', code: 'ADMIN_NOT_FOUND' });
    return { permissions: admin.permissions };
  }

  async updatePermissions(staffId: string, permissions: string[]) {
    const admin = await this.prisma.admin.findUnique({ where: { id: staffId }, select: { id: true } });
    if (!admin) throw new NotFoundException({ message: 'Không tìm thấy nhân viên.', code: 'ADMIN_NOT_FOUND' });
    const updated = await this.prisma.admin.update({ where: { id: staffId }, data: { permissions }, select: { id: true, permissions: true } });
    return { permissions: updated.permissions };
  }
}

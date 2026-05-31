import { api } from "@/config/server";
import type {
  AdminRole,
  AttendanceListResponse,
  AttendanceTodayRecord,
  AttendanceDailySummaryResponse,
  ShiftConfig,
  StaffFaceProfile,
  StaffWithFaceProfile,
  StoreLocation,
  AttendanceRecord,
} from "./types";

export type CreateHrmStaffBody = {
  phone: string;
  name: string;
  role: AdminRole;
  password?: string;
  email?: string;
};

export type HrmStaffRow = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
  faceProfile: { id: string; imageUrl: string | null } | null;
};

export async function createHrmStaff(
  body: CreateHrmStaffBody,
): Promise<{ staff: HrmStaffRow; plainPassword: string }> {
  const { data } = await api.post<{ staff: HrmStaffRow; plainPassword: string }>(
    "/admin/hrm/staff",
    body,
  );
  return data;
}

export async function updateHrmStaff(
  staffId: string,
  body: { name?: string; phone?: string; email?: string; isActive?: boolean },
): Promise<HrmStaffRow> {
  const { data } = await api.patch<HrmStaffRow>(`/admin/hrm/staff/${staffId}`, body);
  return data;
}

export async function resetHrmStaffPassword(
  staffId: string,
  password?: string,
): Promise<{ plainPassword: string }> {
  const { data } = await api.post<{ plainPassword: string }>(
    `/admin/hrm/staff/${staffId}/reset-password`,
    { password },
  );
  return data;
}

export async function deleteHrmStaff(staffId: string): Promise<void> {
  await api.delete(`/admin/hrm/staff/${staffId}`);
}

export async function fetchShiftConfig(): Promise<ShiftConfig> {
  const { data } = await api.get<ShiftConfig>("/admin/hrm/shift-config");
  return data;
}

export async function updateShiftConfig(body: {
  startMinutes: number;
  endMinutes: number;
  toleranceMinutes: number;
}): Promise<ShiftConfig> {
  const { data } = await api.put<ShiftConfig>("/admin/hrm/shift-config", body);
  return data;
}

export async function fetchStoreLocation(): Promise<StoreLocation> {
  const { data } = await api.get<StoreLocation>("/admin/hrm/store-location");
  return data;
}

export async function updateStoreLocation(body: {
  lat: number;
  lng: number;
  radiusMeters: number;
  address?: string;
  phone?: string;
}): Promise<StoreLocation> {
  const { data } = await api.put<StoreLocation>("/admin/hrm/store-location", body);
  return data;
}

export async function fetchStaffWithProfiles(): Promise<StaffWithFaceProfile[]> {
  const { data } = await api.get<StaffWithFaceProfile[]>("/admin/hrm/staff");
  return data;
}

export async function fetchFaceProfile(staffId: string): Promise<StaffFaceProfile | null> {
  const { data } = await api.get<StaffFaceProfile | null>(`/admin/hrm/staff/${staffId}/face-profile`);
  return data;
}

export async function upsertFaceProfile(
  staffId: string,
  body: { descriptor: number[]; imageUrl?: string },
): Promise<StaffFaceProfile> {
  const { data } = await api.put<StaffFaceProfile>(
    `/admin/hrm/staff/${staffId}/face-profile`,
    body,
  );
  return data;
}

export async function fetchMyFaceProfile(): Promise<StaffFaceProfile | null> {
  const { data } = await api.get<StaffFaceProfile | null>("/admin/hrm/my-face-profile");
  return data;
}

export async function fetchAttendanceList(params?: {
  adminId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<AttendanceListResponse> {
  const { data } = await api.get<AttendanceListResponse>("/admin/hrm/attendance", { params });
  return data;
}

export async function fetchAttendanceDailySummary(params?: {
  adminId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<AttendanceDailySummaryResponse> {
  const { data } = await api.get<AttendanceDailySummaryResponse>("/admin/hrm/attendance/daily-summary", { params });
  return data;
}

export async function fetchStaffPermissions(staffId: string): Promise<{ permissions: string[] }> {
  const { data } = await api.get<{ permissions: string[] }>(`/admin/hrm/staff/${staffId}/permissions`);
  return data;
}

export async function updateStaffPermissions(staffId: string, permissions: string[]): Promise<{ permissions: string[] }> {
  const { data } = await api.put<{ permissions: string[] }>(`/admin/hrm/staff/${staffId}/permissions`, { permissions });
  return data;
}

export async function fetchAttendanceToday(): Promise<AttendanceTodayRecord> {
  const { data } = await api.get<AttendanceTodayRecord>("/admin/hrm/attendance/today");
  return data;
}

export async function postCheckin(body: {
  lat: number;
  lng: number;
  descriptor: number[];
}): Promise<AttendanceRecord> {
  const { data } = await api.post<AttendanceRecord>("/admin/hrm/attendance/checkin", body);
  return data;
}

export async function postCheckout(body: {
  lat: number;
  lng: number;
  descriptor: number[];
}): Promise<AttendanceRecord> {
  const { data } = await api.post<AttendanceRecord>("/admin/hrm/attendance/checkout", body);
  return data;
}

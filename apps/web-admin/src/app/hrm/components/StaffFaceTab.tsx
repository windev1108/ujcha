"use client";

import { Button, Card, Chip, Table } from "@heroui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, UserX } from "lucide-react";
import { useState } from "react";

import { fetchStaffWithProfiles } from "@/services/admin/hrm-api";
import type { StaffWithFaceProfile } from "@/services/admin/types";
import { FaceSetupModal } from "./FaceSetupModal";

function initials(staff: StaffWithFaceProfile) {
  return (staff.name ?? staff.phone ?? 'Staff').slice(0, 2).toUpperCase();
}

export function StaffFaceTab() {
  const qc = useQueryClient();
  const [setupTarget, setSetupTarget] = useState<StaffWithFaceProfile | null>(null);

  const staffQ = useQuery({
    queryKey: ["admin", "hrm", "staff"],
    queryFn: fetchStaffWithProfiles,
  });

  const items = staffQ.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <Table.Root aria-label="Danh sách nhận diện nhân viên">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Nhân viên
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Số điện thoại
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Địa chỉ
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Ảnh nhận diện
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Trạng thái
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {staffQ.isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                  : items.map((staff) => (
                    <Table.Row key={staff.id} id={staff.id}>
                      <Table.Cell className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,#1a3c34_10%,white)] text-sm font-bold text-[#1a3c34] ring-1 ring-black/8">
                            {initials(staff)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {staff.name ?? staff.phone ?? 'Staff'}
                            </p>
                            <p className="text-xs text-foreground/50">{staff.email}</p>
                          </div>
                          <Chip
                            size="sm"
                            variant="soft"
                            className={`ml-1 border-0 shrink-0 font-semibold ${staff.role === "super_admin" ? "bg-[color-mix(in_oklab,#1a3c34_12%,white)] text-[#1a3c34] border border-[#1a3c34]/20" : "bg-[color-mix(in_oklab,#71b394_15%,white)] text-[#3a7060] border border-[#71b394]/30"}`}
                          >
                            <Chip.Label>{staff.role === "super_admin" ? "Super Admin" : "Staff"}</Chip.Label>
                          </Chip>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle text-sm">
                        {staff.phone ?? <span className="text-foreground/30">—</span>}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle text-sm max-w-[200px]">
                        {staff.address ? (
                          <span className="truncate block">{staff.address}</span>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle">
                        {staff.faceProfile?.imageUrl ? (
                          <div className="size-14 overflow-hidden rounded-lg border border-black/8 bg-black/4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={staff.faceProfile.imageUrl}
                              alt="Ảnh nhận diện"
                              className="h-full w-full object-cover object-center"
                            />
                          </div>
                        ) : (
                          <div className="flex size-14 items-center justify-center rounded-lg border border-dashed border-black/15 bg-black/3 text-[10px] text-foreground/30">
                            Chưa có
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 align-middle">
                        {staff.faceProfile ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3.5 shrink-0" />
                            Đã đăng ký
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                            <UserX className="size-3.5 shrink-0" />
                            Chưa đăng ký
                          </span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-5 py-4 text-right align-middle">
                        <Button
                          size="sm"
                          variant={staff.faceProfile ? "outline" : "primary"}
                          className={`rounded-lg text-xs ${staff.faceProfile ? "border-black/15" : "bg-[#1a3c34] text-white"}`}
                          onPress={() => setSetupTarget(staff)}
                        >
                          <Camera className="mr-1 size-3.5" />
                          {staff.faceProfile ? "Cập nhật" : "Đăng ký"}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
      </Card>

      <FaceSetupModal
        staff={setupTarget}
        isOpen={setupTarget !== null}
        onClose={() => setSetupTarget(null)}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ["admin", "hrm", "staff"] });
          setSetupTarget(null);
        }}
      />
    </div>
  );
}

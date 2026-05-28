"use client";

import {
  Button,
  Input,
  Label,
  Modal,
  Switch,
  useOverlayState,
} from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  createPointCampaign,
  updatePointCampaign,
} from "@/services/admin/points-api";
import type { PointCampaignSerialized } from "@/services/admin/types";

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return err.message || "Có lỗi xảy ra.";
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  campaign: PointCampaignSerialized | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PointCampaignModal({ campaign, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });

  const [name, setName] = useState("");
  const [earnPercent, setEarnPercent] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEdit = campaign != null;

  useEffect(() => {
    if (!isOpen) return;
    if (campaign) {
      setName(campaign.name);
      setEarnPercent(String(Number.parseFloat(campaign.earnPercent) || 0));
      setStartAt(toLocalInput(campaign.startAt));
      setEndAt(toLocalInput(campaign.endAt));
      setIsActive(campaign.isActive);
    } else {
      setName("");
      setEarnPercent("7");
      setStartAt("");
      setEndAt("");
      setIsActive(true);
    }
  }, [isOpen, campaign]);

  const mut = useMutation({
    mutationFn: async () => {
      const ep = Number.parseFloat(earnPercent.replace(",", "."));
      const startIso = startAt ? new Date(startAt).toISOString() : "";
      const endIso = endAt ? new Date(endAt).toISOString() : "";
      if (!startIso || !endIso) {
        throw new Error("missing-dates");
      }
      if (isEdit && campaign) {
        return updatePointCampaign(campaign.id, {
          name: name.trim(),
          earnPercent: ep,
          startAt: startIso,
          endAt: endIso,
          isActive,
        });
      }
      return createPointCampaign({
        name: name.trim(),
        earnPercent: ep,
        startAt: startIso,
        endAt: endIso,
        isActive,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.pointCampaigns });
      await qc.invalidateQueries({ queryKey: adminKeys.pointConfig });
      onOpenChange(false);
    },
    onError: async (e) => {
      if (e instanceof Error && e.message === "missing-dates") {
        void showAlert("Chọn đủ thời gian bắt đầu và kết thúc.", "Thiếu thông tin");
        return;
      }
      void showAlert(axiosMessage(e), "Lỗi");
    },
  });

  const submit = () => {
    const n = name.trim();
    if (!n) {
      void showAlert("Nhập tên campaign.", "Thiếu thông tin");
      return;
    }
    mut.mutate();
  };

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>
                {isEdit ? "Sửa campaign" : "Tạo campaign"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4 px-5 py-4">
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Tên</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={adminInputClass}
                  placeholder="VD: Summer Vibes 2024"
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>% tích điểm (tối đa 20)</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step="0.1"
                  value={earnPercent}
                  onChange={(e) => setEarnPercent(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Bắt đầu</Label>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Kết thúc</Label>
                <Input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Đang bật</p>
                  <p className="text-xs text-foreground/50">
                    Chỉ áp khi trong khung thời gian và bật.
                  </p>
                </div>
                <Switch
                  isSelected={isActive}
                  onChange={setIsActive}
                  className="shrink-0"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={submit}
                isDisabled={mut.isPending}
              >
                {mut.isPending ? "Đang lưu…" : isEdit ? "Cập nhật" : "Tạo"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

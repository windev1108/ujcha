"use client";

import {
  Button,
  DateField,
  DateRangePicker,
  Input,
  Label,
  ListBox,
  Modal,
  RangeCalendar,
  Select,
  Switch,
  useOverlayState,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminVoucher,
  updateAdminVoucher,
} from "@/services/admin/vouchers-api";
import type { AdminVoucher, AdminVoucherDiscountType } from "@/services/admin/types";

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

/** `YYYY-MM-DD` theo giờ local từ ISO server */
function isoToLocalDateString(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateOnlyToStartIso(ymd: string): string | undefined {
  if (!ymd.trim()) return undefined;
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return undefined;
  return new Date(y, m - 1, day, 0, 0, 0, 0).toISOString();
}

function dateOnlyToEndIso(ymd: string): string | undefined {
  if (!ymd.trim()) return undefined;
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return undefined;
  return new Date(y, m - 1, day, 23, 59, 59, 999).toISOString();
}

function initRangeFromVoucher(
  startsAt: string | null,
  endsAt: string | null,
): { from: string; to: string } {
  const a = isoToLocalDateString(startsAt);
  const b = isoToLocalDateString(endsAt);
  if (a && b) return { from: a, to: b };
  if (a) return { from: a, to: a };
  if (b) return { from: b, to: b };
  return { from: "", to: "" };
}

type Props = {
  voucher: AdminVoucher | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VoucherFormModal({ voucher, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] =
    useState<AdminVoucherDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  /** Khoảng ngày hiệu lực — `YYYY-MM-DD`, đồng bộ với DateRangePicker */
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [isWelcome, setIsWelcome] = useState(false);

  const isEdit = voucher != null;

  const dateRangeValue = useMemo(() => {
    try {
      if (!rangeFrom?.trim() || !rangeTo?.trim()) return null;
      return { start: parseDate(rangeFrom), end: parseDate(rangeTo) };
    } catch {
      return null;
    }
  }, [rangeFrom, rangeTo]);

  useEffect(() => {
    if (!isOpen) return;
    if (voucher) {
      setCode(voucher.code);
      setName(voucher.name);
      setDiscountType(voucher.discountType);
      setDiscountValue(String(Number.parseFloat(voucher.discountValue) || 0));
      setMinOrderAmount(String(Number.parseFloat(voucher.minOrderAmount) || 0));
      setMaxDiscountAmount(
        voucher.maxDiscountAmount != null
          ? String(Number.parseFloat(voucher.maxDiscountAmount))
          : "",
      );
      const r = initRangeFromVoucher(voucher.startsAt, voucher.endsAt);
      setRangeFrom(r.from);
      setRangeTo(r.to);
      setUsageLimit(
        voucher.usageLimit != null ? String(voucher.usageLimit) : "",
      );
      setPerUserLimit(String(voucher.perUserLimit ?? 1));
      setIsActive(voucher.isActive);
      setIsWelcome(voucher.isWelcome ?? false);
    } else {
      setCode("");
      setName("");
      setDiscountType("percent");
      setDiscountValue("");
      setMinOrderAmount("0");
      setMaxDiscountAmount("");
      setRangeFrom("");
      setRangeTo("");
      setUsageLimit("");
      setPerUserLimit("1");
      setIsActive(true);
      setIsWelcome(false);
    }
  }, [isOpen, voucher]);

  const mut = useMutation({
    mutationFn: async () => {
      const dv = Number.parseFloat(discountValue.replace(",", "."));
      const minO = Number.parseFloat(minOrderAmount.replace(",", "."));
      const maxParsed = Number.parseFloat(maxDiscountAmount.replace(",", "."));
      const ul =
        usageLimit.trim() === ""
          ? undefined
          : Number.parseInt(usageLimit, 10);
      const pul = Number.parseInt(perUserLimit, 10);

      const maxForPercent =
        discountType === "percent" && maxDiscountAmount.trim() !== ""
          ? maxParsed
          : undefined;

      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        discountType,
        discountValue: dv,
        minOrderAmount: Number.isFinite(minO) ? minO : 0,
        maxDiscountAmount:
          discountType === "percent"
            ? maxForPercent !== undefined && Number.isFinite(maxForPercent)
              ? maxForPercent
              : null
            : null,
        startsAt: dateOnlyToStartIso(rangeFrom),
        endsAt: dateOnlyToEndIso(rangeTo),
        usageLimit: ul,
        perUserLimit: Number.isFinite(pul) && pul >= 1 ? pul : 1,
        isActive,
        isWelcome,
      };

      if (isEdit && voucher) {
        return updateAdminVoucher(voucher.id, payload);
      }

      const createBody: Parameters<typeof createAdminVoucher>[0] = {
        code: payload.code,
        name: payload.name,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        minOrderAmount: payload.minOrderAmount,
        perUserLimit: payload.perUserLimit,
        isActive: payload.isActive,
        ...(payload.startsAt ? { startsAt: payload.startsAt } : {}),
        ...(payload.endsAt ? { endsAt: payload.endsAt } : {}),
        ...(ul !== undefined ? { usageLimit: ul } : {}),
        isWelcome,
      };
      if (discountType === "percent" && maxForPercent !== undefined && Number.isFinite(maxForPercent)) {
        createBody.maxDiscountAmount = maxForPercent;
      }
      return createAdminVoucher(createBody);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.vouchers });
      await qc.invalidateQueries({ queryKey: adminKeys.voucherStats });
      onOpenChange(false);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const submit = () => {
    const c = code.trim();
    const n = name.trim();
    if (c.length < 2) {
      void showAlert("Mã voucher ít nhất 2 ký tự.", "Thiếu thông tin");
      return;
    }
    if (!n) {
      void showAlert("Vui lòng nhập tên hiển thị.", "Thiếu thông tin");
      return;
    }
    const dv = Number.parseFloat(discountValue.replace(",", "."));
    if (!Number.isFinite(dv) || dv < 0) {
      void showAlert("Giá trị giảm không hợp lệ.", "Thiếu thông tin");
      return;
    }
    if (discountType === "percent" && dv > 100) {
      void showAlert("Phần trăm giảm không được vượt 100%.", "Thiếu thông tin");
      return;
    }
    mut.mutate();
  };

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="max-w-lg rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>
                {isEdit ? "Sửa voucher" : "Tạo voucher mới"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4 px-5 py-4">
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Mã (code)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={adminInputClass}
                  placeholder="VD: KUNNEW24"
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Tên hiển thị</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={adminInputClass}
                  placeholder="VD: Matcha Morning"
                />
              </div>
              <div className={`${adminFieldStackLoose}`}>
                <Label className={adminLabelClass}>Loại giảm</Label>
                <Select
                  className="w-full"
                  value={discountType}
                  onChange={(key) => {
                    if (key != null)
                      setDiscountType(key as AdminVoucherDiscountType);
                  }}
                >
                  <Select.Trigger className={adminInputClass}>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      <ListBox.Item
                        id="percent"
                        textValue="Phần trăm"
                        className="rounded-lg text-sm"
                      >
                        Phần trăm (%)
                      </ListBox.Item>
                      <ListBox.Item
                        id="fixed_amount"
                        textValue="Số tiền cố định"
                        className="rounded-lg text-sm"
                      >
                        Số tiền cố định (VNĐ)
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`${adminFieldStackLoose}`}>
                  <Label className={adminLabelClass}>
                    {discountType === "percent"
                      ? "Giảm (%)"
                      : "Giảm (VNĐ)"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className={adminInputClass}
                  />
                </div>
                <div className={`${adminFieldStackLoose}`}>
                  <Label className={adminLabelClass}>Đơn tối thiểu (VNĐ)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1000"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className={adminInputClass}
                  />
                </div>
              </div>
              {discountType === "percent" ? (
                <div className={`${adminFieldStackLoose}`}>
                  <Label className={adminLabelClass}>
                    Trần giảm (VNĐ, tuỳ chọn)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="1000"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    className={adminInputClass}
                    placeholder="Để trống = không trần"
                  />
                </div>
              ) : null}
              <div className={`${adminFieldStackLoose}`}>
                <DateRangePicker
                  className="flex w-full flex-col gap-2.5"
                  value={dateRangeValue ?? undefined}
                  onChange={(r) => {
                    if (r == null) {
                      setRangeFrom("");
                      setRangeTo("");
                      return;
                    }
                    if (!r.start || !r.end) return;
                    setRangeFrom(r.start.toString());
                    setRangeTo(r.end.toString());
                  }}
                  granularity="day"
                >
                  <Label className={adminLabelClass}>
                    Hiệu lực (từ ngày – đến ngày)
                  </Label>
                  <DateField.Group
                    className="min-h-11 w-full rounded-xl border border-black/10 bg-[#fafafa] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                    fullWidth
                    variant="secondary"
                  >
                    <DateField.InputContainer className="min-w-0 flex-1 px-1">
                      <DateField.Input slot="start" className="min-w-0">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateRangePicker.RangeSeparator className="shrink-0 px-0.5 text-foreground/35">
                        –
                      </DateRangePicker.RangeSeparator>
                      <DateField.Input slot="end" className="min-w-0">
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                    </DateField.InputContainer>
                    <DateField.Suffix className="shrink-0 pr-1">
                      <DateRangePicker.Trigger
                        type="button"
                        className="inline-flex size-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-black/6"
                      >
                        <DateRangePicker.TriggerIndicator />
                      </DateRangePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DateRangePicker.Popover className="rounded-2xl p-2 shadow-lg">
                    <RangeCalendar aria-label="Chọn khoảng hiệu lực voucher">
                      <RangeCalendar.Header>
                        <RangeCalendar.YearPickerTrigger>
                          <RangeCalendar.YearPickerTriggerHeading />
                          <RangeCalendar.YearPickerTriggerIndicator />
                        </RangeCalendar.YearPickerTrigger>
                        <RangeCalendar.NavButton slot="previous" />
                        <RangeCalendar.NavButton slot="next" />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => (
                            <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
                          )}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>
                          {(date) => <RangeCalendar.Cell date={date} />}
                        </RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                    </RangeCalendar>
                  </DateRangePicker.Popover>
                </DateRangePicker>
                <p className="text-xs text-foreground/50">
                  Ngày bắt đầu 00:00, ngày kết thúc 23:59 (giờ máy). Để trống cả
                  hai khi chọn lại trên lịch = không giới hạn thời gian.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`${adminFieldStackLoose}`}>
                  <Label className={adminLabelClass}>
                    Giới hạn tổng lượt
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className={adminInputClass}
                  />
                </div>
                <div className={`${adminFieldStackLoose}`}>
                  <Label className={adminLabelClass}>Mỗi user tối đa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={perUserLimit}
                    onChange={(e) => setPerUserLimit(e.target.value)}
                    className={adminInputClass}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Đang bật
                  </p>
                  <p className="text-xs text-foreground/50">
                    Tắt để không áp dụng khi nhập mã.
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
              <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Voucher chào mừng
                  </p>
                  <p className="text-xs text-foreground/50">
                    Tự động cấp cho mọi user mới đăng ký. Chỉ nên bật 1 mã.
                  </p>
                </div>
                <Switch
                  isSelected={isWelcome}
                  onChange={setIsWelcome}
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
                {mut.isPending ? "Đang lưu…" : isEdit ? "Cập nhật" : "Tạo mã"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

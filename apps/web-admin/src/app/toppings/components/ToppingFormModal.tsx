"use client";

import {
  Button,
  Input,
  Label,
  Modal,
  Switch,
  Text,
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
import { formatVnd } from "@/lib/product-display";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminTopping,
  updateAdminTopping,
} from "@/services/admin/toppings-api";
import type { AdminTopping } from "@/services/admin/types";

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

type Props = {
  topping: AdminTopping | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ToppingFormModal({ topping, isOpen, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const modal = useOverlayState({ isOpen, onOpenChange });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const isEdit = topping != null;

  useEffect(() => {
    if (isOpen) {
      setName(topping?.name ?? "");
      setPrice(
        topping != null ? String(Number.parseFloat(topping.price) || 0) : "",
      );
      setSortOrder(String(topping?.sortOrder ?? 0));
      setIsActive(topping?.isActive ?? true);
    }
  }, [isOpen, topping]);

  const mut = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      const p = Number.parseFloat(price.replace(",", "."));
      const so = Number.parseInt(sortOrder, 10);
      if (isEdit && topping) {
        return updateAdminTopping(topping.id, {
          name: n,
          price: p,
          sortOrder: Number.isFinite(so) ? so : 0,
          isActive,
        });
      }
      return createAdminTopping({
        name: n,
        price: p,
        sortOrder: Number.isFinite(so) ? so : 0,
        isActive,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: adminKeys.toppings });
      onOpenChange(false);
    },
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const submit = () => {
    const n = name.trim();
    if (!n) {
      void showAlert("Vui lòng nhập tên topping.", "Thiếu thông tin");
      return;
    }
    const p = Number.parseFloat(price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) {
      void showAlert("Giá không hợp lệ.", "Thiếu thông tin");
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
                {isEdit ? "Sửa topping" : "Thêm topping"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-5 px-5 py-4">
              <Text className="text-sm leading-relaxed text-foreground/65">
                Topping cộng thêm vào món (trân châu, kem, thạch…). Giá cộng vào
                dòng khi POS chọn.
              </Text>
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>
                  Tên
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Trân châu đen"
                  className={adminInputClass}
                />
              </div>
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>
                  Giá (VND)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="5000"
                  className={adminInputClass}
                />
              </div>
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>
                  Thứ tự hiển thị
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className={adminInputClass}
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Đang bán
                  </p>
                  <p className="text-xs text-foreground/50">
                    Tắt để ẩn khỏi POS (không xoá dữ liệu).
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
              {price.trim() && Number.isFinite(Number.parseFloat(price)) ? (
                <p className="text-xs text-foreground/50">
                  Xem trước: {formatVnd(Number.parseFloat(price))}
                </p>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button
                className="rounded-full bg-[#1a3c34] font-semibold text-white"
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

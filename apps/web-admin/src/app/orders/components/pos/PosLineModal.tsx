"use client";

import {
  Button,
  Checkbox,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Text,
  useOverlayState,
} from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

import {
  adminFieldStack,
  adminFieldStackLoose,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { formatVnd } from "@/lib/product-display";
import {
  computeOptionSurcharge,
  computePosUnitPrice,
  normalizeProductOptionGroups,
  toppingsByIdMap,
} from "@/lib/pos-line-price";
import type { AdminProduct, AdminTopping } from "@/services/admin/types";

import type { PosCartLine } from "./pos-types";

type Props = {
  product: AdminProduct | null;
  toppings: AdminTopping[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (line: Omit<PosCartLine, "lineId">) => void;
};

export function PosLineModal({
  product,
  toppings,
  isOpen,
  onOpenChange,
  onConfirm,
}: Props) {
  const overlay = useOverlayState({ isOpen, onOpenChange });

  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(
    () => new Set(),
  );
  const [options, setOptions] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const map = useMemo(() => toppingsByIdMap(toppings), [toppings]);

  const optionGroupsNorm = useMemo(
    () =>
      product ? normalizeProductOptionGroups(product.optionGroups) : [],
    [product],
  );

  useEffect(() => {
    if (!isOpen || !product) return;
    setSelectedToppings(new Set());
    setNote("");
    const groups = normalizeProductOptionGroups(product.optionGroups);
    const next: Record<string, string> = {};
    for (const g of groups) {
      const freeVal = g.values.find((v) => (v.priceDelta ?? 0) === 0) ?? g.values[0];
      if (freeVal) next[g.name] = freeVal.label;
    }
    setOptions(next);
  }, [isOpen, product]);

  const base = product
    ? Number.parseFloat(product.price)
    : 0;
  const toppingIds = useMemo(
    () => [...selectedToppings],
    [selectedToppings],
  );
  const optionExtra = product
    ? computeOptionSurcharge(optionGroupsNorm, options)
    : 0;
  const unit = product
    ? computePosUnitPrice(base, toppingIds, map, optionExtra)
    : 0;

  const confirm = () => {
    if (!product) return;
    for (const g of optionGroupsNorm) {
      if (!options[g.name]?.trim()) {
        return;
      }
    }
    onConfirm({
      productId: product.id,
      name: product.name,
      basePrice: base,
      unitPrice: unit,
      quantity: 1,
      toppingIds,
      options: { ...options },
      note: note.trim() || undefined,
    });
    onOpenChange(false);
  };

  const toggleTop = (id: string, v: boolean) => {
    setSelectedToppings((prev) => {
      const n = new Set(prev);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  return (
    <Modal.Root state={overlay}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[90vh] max-w-lg rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading className="text-left">
                {product?.name ?? "Món"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-6 px-5 py-4">
              {optionGroupsNorm.length ? (
                <div className={adminFieldStackLoose}>
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Tuỳ chọn món
                  </Text>
                  {optionGroupsNorm.map((g) => (
                    <div key={g.id} className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        {g.name}
                      </Label>
                      <Select
                        className="w-full"
                        value={options[g.name] ?? ""}
                        onChange={(key) =>
                          setOptions((o) => ({
                            ...o,
                            [g.name]: key == null ? "" : String(key),
                          }))
                        }
                      >
                        <Select.Trigger className={adminSelectTriggerClass}>
                          <Select.Value className={adminSelectValueClass} />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover placement="bottom start">
                          <ListBox className="max-h-48 min-w-(--trigger-width) outline-none">
                            {g.values.map((v) => (
                              <ListBox.Item
                                key={v.label}
                                id={v.label}
                                textValue={
                                  v.priceDelta > 0
                                    ? `${v.label} (+${formatVnd(String(v.priceDelta))})`
                                    : v.label
                                }
                                className="rounded-lg text-sm"
                              >
                                <span className="flex w-full items-center justify-between gap-2">
                                  <span>{v.label}</span>
                                  {v.priceDelta > 0 ? (
                                    <span className="shrink-0 tabular-nums text-foreground/70">
                                      +{formatVnd(String(v.priceDelta))}
                                    </span>
                                  ) : null}
                                  <span></span>
                                </span>
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={adminFieldStackLoose}>
                <div className="space-y-1">
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                    Topping thêm
                  </Text>
                  <Description className="text-xs leading-relaxed text-foreground/50">
                    Chọn thêm — giá cộng vào đơn giá dòng.
                  </Description>
                </div>
                <div
                  className="max-h-[min(50vh,320px)] space-y-2 overflow-y-auto scroll-smooth rounded-xl border border-black/8 bg-[#fafafa] p-2 pr-1"
                  role="listbox"
                  aria-label="Danh sách topping"
                  aria-multiselectable="true"
                >
                  {toppings.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-foreground/45">
                      Chưa có topping — thêm tại quản trị (Topping).
                    </p>
                  ) : (
                    toppings.map((t) => {
                      const sel = selectedToppings.has(t.id);
                      return (
                        <label
                          key={t.id}
                          role="option"
                          aria-selected={sel}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${sel
                            ? "border-[#1a3c34]/45 bg-[color-mix(in_oklab,#71b394_22%,white)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                            : "border-transparent bg-white hover:border-black/10 hover:bg-white"
                            }`}
                        >
                          <Checkbox
                            isSelected={sel}
                            onChange={(v) => toggleTop(t.id, v)}
                            aria-label={t.name}
                          />
                          <span
                            className={`min-w-0 flex-1 text-sm font-medium ${sel ? "text-[#1a3c34]" : "text-foreground"}`}
                          >
                            {t.name}
                          </span>
                          <span
                            className={`shrink-0 text-sm tabular-nums ${sel ? "font-semibold text-[#1a3c34]" : "text-foreground/70"}`}
                          >
                            +{formatVnd(t.price)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {toppings.length > 0 ? (
                  <p className="text-[11px] text-foreground/45">
                    Đã chọn{" "}
                    <span className="font-semibold text-[#1a3c34]">
                      {selectedToppings.size}
                    </span>{" "}
                    topping — danh sách cuộn khi có nhiều món phụ.
                  </p>
                ) : null}
              </div>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>
                  Ghi chú (tuỳ chọn)
                </Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ít đá, không ống hút…"
                  className="h-11 rounded-xl border border-black/10 bg-white"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#1a3c34]/8 px-4 py-3">
                <span className="text-sm font-semibold text-[#1a3c34]">
                  Đơn giá dòng
                </span>
                <span className="text-lg font-bold tabular-nums text-[#1a3c34]">
                  {formatVnd(String(unit))}
                </span>
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={confirm}
                isDisabled={!product}
              >
                Thêm vào giỏ
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

"use client";

import {
  Button,
  Card,
  CardContent,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  ArrowLeft,
  Printer,
  QrCode,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  adminFieldStack,
  adminSelectTriggerLargeSoftClass,
  adminSelectTriggerRoundedMutedClass,
  adminSelectValueClass,
  adminSelectValueLargeClass,
} from "@/lib/admin-form-classes";
import { ROUTES } from "@/lib/routes";
import { tableAreaSelectOptions } from "@/lib/table-areas";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminTable,
  fetchAdminTable,
  updateAdminTable,
} from "@/services/admin/tables-api";

function parseApiMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: unknown } } })
      .response?.data;
    const m = data?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Không lưu được.";
}

type Props = { mode: "create" | "edit"; tableId?: string };

export function TableFormClient({ mode, tableId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [area, setArea] = useState("Tầng 1");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tableQuery = useQuery({
    queryKey: tableId ? adminKeys.table(tableId) : ["admin", "tables", "noop"],
    queryFn: () => fetchAdminTable(tableId!),
    enabled: mode === "edit" && Boolean(tableId),
  });

  const areaOptions = useMemo(() => {
    if (mode === "edit" && tableQuery.data?.area) {
      return tableAreaSelectOptions([tableQuery.data.area]);
    }
    return tableAreaSelectOptions([]);
  }, [mode, tableQuery.data?.area]);

  useEffect(() => {
    if (mode !== "edit" || !tableQuery.data) return;
    const t = tableQuery.data;
    setName(t.name);
    setArea(t.area ?? "Tầng 1");
    setIsActive(t.isActive);
  }, [mode, tableQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        return createAdminTable({
          name: name.trim(),
          area: area.trim() || undefined,
        });
      }
      if (!tableId) throw new Error("Thiếu id bàn.");
      return updateAdminTable(tableId, {
        name: name.trim(),
        area: area.trim(),
        isActive,
      });
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.tables });
      await queryClient.invalidateQueries({ queryKey: adminKeys.tableStats });
      if (mode === "edit" && tableId) {
        await queryClient.invalidateQueries({
          queryKey: adminKeys.table(tableId),
        });
      }
      if (mode === "create") {
        router.push(`${ROUTES.tableQr(row.id)}?print=1`);
      } else {
        router.push(ROUTES.TABLES);
      }
    },
    onError: (e: AxiosError | Error) => {
      setError(parseApiMessage(e));
    },
  });

  const pending = saveMut.isPending;
  const loadingEdit = mode === "edit" && tableQuery.isLoading;

  if (mode === "edit" && tableQuery.isError) {
    return (
      <p className="text-sm text-red-700">
        Không tải được bàn.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => router.push(ROUTES.TABLES)}
        >
          Quay lại
        </button>
      </p>
    );
  }

  if (loadingEdit) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6 pb-16">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-black/5" />
        <Card className="rounded-3xl border border-black/6">
          <CardContent className="space-y-4 p-8">
            <div className="h-8 w-3/4 animate-pulse rounded-lg bg-black/5" />
            <div className="h-4 w-full animate-pulse rounded bg-black/5" />
            <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
            <div className="h-12 animate-pulse rounded-2xl bg-black/5" />
            <div className="aspect-square max-w-[220px] animate-pulse rounded-3xl bg-black/5" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-8 pb-20">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit rounded-xl"
          onPress={() => router.push(ROUTES.TABLES)}
        >
          <ArrowLeft className="mr-2 size-4" />
          Quay lại
        </Button>

        <Card className="rounded-3xl border border-black/8 bg-white shadow-[0_20px_60px_-28px_rgba(0,0,0,0.18)]">
          <CardContent className="flex flex-col gap-8 p-8 sm:p-10">
            <div className="space-y-2 text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-[#1a3c34]">
                Thêm bàn mới
              </h1>
              <p className="text-sm text-foreground/55">
                Thiết lập thông tin cho vị trí ngồi mới của khách hàng.
              </p>
            </div>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">
                {error}
              </p>
            ) : null}

            <div className={adminFieldStack}>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/45">
                Tên bàn / số bàn
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Bàn 06"
                className="h-12 rounded-2xl border-0 bg-[#f3f4f6] px-4 text-base ring-1 ring-black/6"
                disabled={pending}
              />
            </div>

            <div className={adminFieldStack}>
              <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/45">
                Khu vực
              </Label>
              <Select
                value={area}
                onChange={(key) =>
                  setArea(key == null ? "Tầng 1" : String(key))
                }
                isDisabled={pending}
              >
                <Select.Trigger className={adminSelectTriggerLargeSoftClass}>
                  <Select.Value className={adminSelectValueLargeClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="max-h-56 min-w-(--trigger-width) outline-none">
                    {areaOptions.map((a) => (
                      <ListBox.Item
                        key={a}
                        id={a}
                        textValue={a}
                        className="rounded-xl text-sm"
                      >
                        {a}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-black/12 bg-[#fafafa] px-6 py-10">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white text-foreground/25 shadow-sm ring-1 ring-black/6">
                <QrCode className="size-9 stroke-[1.25]" />
              </span>
              <p className="text-center text-sm font-medium text-foreground/45">
                Mã QR sẽ tự động khởi tạo
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="button"
                className="h-12 rounded-2xl bg-[#2d6a5d] text-base font-semibold text-white hover:bg-[#255a4f]"
                onPress={() => {
                  setError(null);
                  if (!name.trim()) {
                    setError("Vui lòng nhập tên bàn.");
                    return;
                  }
                  saveMut.mutate();
                }}
                isDisabled={pending}
              >
                <Printer className="mr-2 size-5" />
                {pending ? "Đang tạo…" : "Tạo bàn & In mã QR"}
              </Button>
              <Button
                variant="ghost"
                className="text-foreground/60"
                onPress={() => router.push(ROUTES.TABLES)}
                isDisabled={pending}
              >
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="mt-0.5 shrink-0 rounded-xl"
            onPress={() => router.push(ROUTES.TABLES)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
              Không gian
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34]">
              Chỉnh sửa bàn
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tableId ? (
            <Button
              variant="outline"
              className="rounded-xl border-black/15"
              onPress={() => router.push(ROUTES.tableQr(tableId))}
            >
              <QrCode className="mr-2 size-4" />
              Xem mã QR
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="rounded-xl"
            onPress={() => router.push(ROUTES.TABLES)}
          >
            Hủy
          </Button>
          <Button
            className="rounded-xl bg-[#1a3c34] font-semibold text-white"
            onPress={() => {
              setError(null);
              if (!name.trim()) {
                setError("Vui lòng nhập tên bàn.");
                return;
              }
              saveMut.mutate();
            }}
            isDisabled={pending}
          >
            <Save className="mr-2 size-4" />
            {pending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <Card className="rounded-3xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#1a3c34]">
            Thông tin bàn
          </h2>
          <div className={adminFieldStack}>
            <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/45">
              Tên bàn / số bàn
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bàn 01"
              className="h-11 rounded-2xl border border-black/10 bg-[#f9fafb]"
              disabled={pending}
            />
          </div>
          <div className={adminFieldStack}>
            <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/45">
              Khu vực
            </Label>
            <Select
              value={area}
              onChange={(key) =>
                setArea(key == null ? "Tầng 1" : String(key))
              }
              isDisabled={pending}
            >
              <Select.Trigger className={adminSelectTriggerRoundedMutedClass}>
                <Select.Value className={adminSelectValueClass} />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom start">
                <ListBox className="max-h-56 min-w-(--trigger-width) outline-none">
                  {areaOptions.map((a) => (
                    <ListBox.Item
                      key={a}
                      id={a}
                      textValue={a}
                      className="rounded-lg text-sm"
                    >
                      {a}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Description className="text-xs text-foreground/50">
              Chọn tầng / khu vực hiển thị trên sơ đồ.
            </Description>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f9fafb] p-4 ring-1 ring-black/6">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Đang hoạt động
              </p>
              <Description className="text-xs text-foreground/55">
                Tắt khi không còn sử dụng bàn (vẫn giữ lịch sử đơn).
              </Description>
            </div>
            <Switch
              isSelected={isActive}
              onChange={setIsActive}
              isDisabled={pending}
              aria-label="Bàn đang hoạt động"
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
          {tableId ? (
            <p className="text-xs text-foreground/50">
              ID bàn:{" "}
              <span className="font-mono text-foreground/70">{tableId}</span>{" "}
              —{" "}
              <Link
                href={ROUTES.tableQr(tableId)}
                className="font-medium text-[#1a3c34] underline"
              >
                Trang mã QR
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

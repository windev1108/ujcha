"use client";

import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { CheckCircle2, Copy, ExternalLink, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminInputClass,
  adminLabelClass,
} from "@/lib/admin-form-classes";
import { adminKeys } from "@/services/admin/keys";
import {
  fetchPaymentConfig,
  updatePaymentConfig,
} from "@/services/admin/payment-config-api";

const SEPAY_QR_BASE = "https://qr.sepay.vn/img";

const SEPAY_BANKS = [
  { value: "MB", label: "MBBank" },
  { value: "Vietcombank", label: "Vietcombank" },
  { value: "Techcombank", label: "Techcombank" },
  { value: "BIDV", label: "BIDV" },
  { value: "Vietinbank", label: "VietinBank" },
  { value: "ACB", label: "ACB" },
  { value: "TPBank", label: "TPBank" },
  { value: "VPBank", label: "VPBank" },
  { value: "Agribank", label: "Agribank" },
  { value: "MSB", label: "MSB" },
  { value: "OCB", label: "OCB" },
  { value: "KienlongBank", label: "KienlongBank" },
  { value: "Eximbank", label: "Eximbank" },
  { value: "HDBank", label: "HDBank" },
  { value: "Sacombank", label: "Sacombank" },
  { value: "VIB", label: "VIB" },
  { value: "ABBank", label: "ABBank" },
  { value: "LPBank", label: "LPBank" },
  { value: "BacABank", label: "Bac A Bank" },
  { value: "SeABank", label: "SeABank" },
  { value: "SHB", label: "SHB" },
  { value: "NCB", label: "NCB" },
  { value: "WooriBank", label: "Woori Bank" },
  { value: "VietABank", label: "VietABank" },
  { value: "VietBank", label: "VietBank" },
  { value: "NamABank", label: "Nam A Bank" },
  { value: "PGBank", label: "PGBank" },
  { value: "PublicBank", label: "PublicBank" },
];

function axiosMessage(e: unknown): string {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const d = err.response?.data;
  if (d && typeof d === "object") {
    const m = d.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  return (err as Error).message || "Có lỗi xảy ra.";
}

function buildQrUrl(
  bank: string,
  acc: string,
  amount?: string,
  des?: string,
): string {
  const params = new URLSearchParams({ bank, acc, template: "compact" });
  const amt = Number.parseFloat(amount ?? "");
  if (Number.isFinite(amt) && amt > 0) params.set("amount", String(Math.round(amt)));
  if (des?.trim()) params.set("des", des.trim());
  return `${SEPAY_QR_BASE}?${params.toString()}`;
}

export function PaymentConfigClient() {
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const { data: config, isLoading } = useQuery({
    queryKey: adminKeys.paymentConfig,
    queryFn: fetchPaymentConfig,
  });

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [sePayApiKey, setSePayApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  const [previewAmount, setPreviewAmount] = useState("");
  const [previewDes, setPreviewDes] = useState("UJCHA-ORDER-XXX");

  const [copied, setCopied] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  useEffect(() => {
    if (!config) return;
    setBankCode(config.bankCode);
    setAccountNumber(config.accountNumber);
    setAccountName(config.accountName);
    setSePayApiKey(config.sePayApiKey);
    setIsEnabled(config.isEnabled);
  }, [config]);

  const saveMut = useMutation({
    mutationFn: () =>
      updatePaymentConfig({
        bankCode: bankCode.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        sePayApiKey: sePayApiKey.trim(),
        isEnabled,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.paymentConfig }),
    onError: async (e) => showAlert(axiosMessage(e), "Lỗi"),
  });

  const isDirty =
    !isLoading &&
    (!config ||
      bankCode !== config.bankCode ||
      accountNumber !== config.accountNumber ||
      accountName !== config.accountName ||
      sePayApiKey !== config.sePayApiKey ||
      isEnabled !== config.isEnabled);

  const qrCanPreview = bankCode.trim() && accountNumber.trim();

  const qrUrl = useMemo(() => {
    if (!qrCanPreview) return null;
    return buildQrUrl(bankCode.trim(), accountNumber.trim(), previewAmount, previewDes);
  }, [bankCode, accountNumber, previewAmount, previewDes, qrCanPreview]);

  const copyUrl = async () => {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Thanh toán
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Cấu hình SePay QR
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Thiết lập tài khoản ngân hàng và API key SePay. Mỗi đơn hàng sẽ sinh QR riêng
            với mã <span className="font-mono font-semibold text-[#1a3c34]">paymentCode</span>{" "}
            nhúng vào trường <span className="font-mono font-semibold text-[#1a3c34]">des</span>{" "}
            để webhook tự động đối soát.
          </p>
        </div>
        <Button
          className="w-fit shrink-0 rounded-full bg-[#1a3c34] px-6 font-semibold text-white shadow-md shadow-[#1a3c34]/20"
          onPress={() => saveMut.mutate()}
          isDisabled={saveMut.isPending || !isDirty}
        >
          {saveMut.isPending ? "Đang lưu…" : isDirty ? "Lưu cấu hình" : "Đã lưu"}
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Config form ── */}
        <div className="flex flex-col gap-6">
          {/* Toggle */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a3c34]">Bật thanh toán QR</p>
                <p className="mt-0.5 text-xs text-foreground/55">
                  Khi bật, đơn hàng sẽ hiển thị QR SePay và chờ webhook xác nhận.
                </p>
              </div>
              <Switch
                isSelected={isEnabled}
                onChange={setIsEnabled}
                isDisabled={isLoading || saveMut.isPending}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </CardContent>
          </Card>

          {/* Bank info */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Thông tin tài khoản
              </p>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Ngân hàng *</Label>
                <Select
                  value={bankCode}
                  onChange={(key) => setBankCode(key as string)}
                  placeholder="Chọn ngân hàng"
                  isDisabled={isLoading || saveMut.isPending}
                >
                  <Select.Trigger className={adminInputClass}>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox className="max-h-60 min-w-(--trigger-width) overflow-y-auto outline-none">
                      {SEPAY_BANKS.map((b) => (
                        <ListBox.Item
                          key={b.value}
                          id={b.value}
                          textValue={b.label}
                          className="rounded-lg text-sm"
                        >
                          {b.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Số tài khoản *</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="040091601771"
                  className={adminInputClass}
                  disabled={isLoading || saveMut.isPending}
                />
              </div>

              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>Tên người nhận</Label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="NGUYEN VAN A"
                  className={adminInputClass}
                  disabled={isLoading || saveMut.isPending}
                />
                <p className="text-[11px] text-foreground/45">
                  Hiển thị cho khách khi quét QR (in hoa, không dấu).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhook */}
          <Card className="rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                Webhook SePay
              </p>
              <div className={adminFieldStack}>
                <Label className={adminLabelClass}>API Key SePay</Label>
                <Input
                  type="password"
                  value={sePayApiKey}
                  onChange={(e) => setSePayApiKey(e.target.value)}
                  placeholder="sepay_xxxxxxxxxxxxxxxx"
                  className={adminInputClass}
                  disabled={isLoading || saveMut.isPending}
                  autoComplete="off"
                />
                <p className="text-[11px] text-foreground/45">
                  Token xác minh chữ ký webhook từ SePay. Lấy tại dashboard SePay → API Keys.
                </p>
              </div>

              <div className="rounded-xl border border-black/8 bg-[#fafafa] px-4 py-3">
                <p className="text-xs font-semibold text-foreground/70">
                  Webhook endpoint
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#1a3c34]">
                  POST /api/webhooks/sepay
                </p>
                <p className="mt-2 text-[11px] text-foreground/50">
                  Điền URL này vào cấu hình webhook trên dashboard SePay. Khi nhận được
                  webhook, hệ thống sẽ khớp trường{" "}
                  <span className="font-mono font-semibold">content</span> với{" "}
                  <span className="font-mono font-semibold">paymentCode</span> của đơn
                  hàng và tự động cập nhật trạng thái thanh toán.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── QR Preview ── */}
        <div className="flex flex-col gap-4">
          <Card className="sticky top-6 rounded-2xl border border-black/6 shadow-sm">
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-[#1a3c34]" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Xem trước QR
                </p>
              </div>

              {qrCanPreview ? (
                <>
                  <div className="flex items-center justify-center rounded-xl border border-black/8 bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={`${qrUrl}-${qrKey}`}
                      src={qrUrl ?? ""}
                      alt="SePay QR preview"
                      className="h-48 w-48 rounded-lg object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>Số tiền thử (đ)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={previewAmount}
                        onChange={(e) => setPreviewAmount(e.target.value)}
                        placeholder="Không bắt buộc"
                        className={adminInputClass}
                      />
                    </div>
                    <div className={adminFieldStack}>
                      <Label className={adminLabelClass}>
                        Mô tả thử <span className="font-mono lowercase">(des)</span>
                      </Label>
                      <Input
                        value={previewDes}
                        onChange={(e) => setPreviewDes(e.target.value)}
                        placeholder="UJCHA-ORDER-XXX"
                        className={adminInputClass}
                      />
                      <p className="text-[11px] text-foreground/45">
                        Trong thực tế đây sẽ là{" "}
                        <span className="font-mono font-semibold">paymentCode</span> của đơn hàng.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQrKey((k) => k + 1)}
                      className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/4 hover:text-foreground"
                    >
                      <RefreshCw className="size-3.5" />
                      Làm mới
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyUrl()}
                      className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/4 hover:text-foreground"
                    >
                      {copied ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "Đã sao chép" : "Sao chép URL"}
                    </button>
                    <a
                      href={qrUrl ?? ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/4 hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                      Mở
                    </a>
                  </div>

                  <div className="rounded-xl border border-black/8 bg-[#fafafa] p-3">
                    <p className="break-all font-mono text-[10px] text-foreground/50">
                      {qrUrl}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/10 text-foreground/35">
                  <QrCode className="size-10" />
                  <p className="text-sm">
                    Nhập ngân hàng và số tài khoản để xem trước QR
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isEnabled && bankCode && accountNumber && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p>
                Thanh toán QR đã bật. Đơn hàng sẽ hiển thị QR với tài khoản{" "}
                <span className="font-semibold">{accountNumber}</span>{" "}
                ({bankCode}).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

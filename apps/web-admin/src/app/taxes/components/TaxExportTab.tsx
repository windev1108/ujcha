"use client";

import { useState } from "react";
import { Button, Card, CardContent, Table, Text } from "@heroui/react";
import { Download, FileText } from "lucide-react";

import { downloadTaxExportCsv } from "@/services/admin/taxes-api";
import { OrderDateRangePicker } from "@/app/orders/components/OrderDateRangePicker";

function todayStr() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function firstDayOfMonthStr() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const CSV_COLUMNS = [
  "Ngày",
  "Mã đơn",
  "Loại đơn",
  "Trạng thái",
  "Thanh toán",
  "Khách hàng",
  "Tổng tiền hàng",
  "Giảm giá",
  "Doanh thu (VND)",
  "Thuế GTGT %",
  "Thuế GTGT (VND)",
];

const INVOICE_FIELDS = [
  { field: "Ngày hoá đơn", source: "Cột «Ngày»", note: "Ngày tạo đơn hàng" },
  { field: "Số hoá đơn", source: "Cột «Mã đơn»", note: "Tham chiếu paymentCode" },
  { field: "Tên hàng hoá / dịch vụ", source: "Chi tiết đơn", note: "Liệt kê từng OrderItem" },
  { field: "Đơn giá", source: "Từng sản phẩm", note: "Giá snapshot tại thời điểm đặt" },
  { field: "Thành tiền trước thuế", source: "Cột «Doanh thu»", note: "finalAmount" },
  { field: "Thuế suất GTGT", source: "Cột «Thuế GTGT %»", note: "vatRate snapshot" },
  { field: "Tiền thuế GTGT", source: "Cột «Thuế GTGT (VND)»", note: "vatAmount snapshot" },
  { field: "Tổng cộng", source: "«Doanh thu» + «Thuế GTGT»", note: "Đã bao gồm thuế" },
  { field: "Người mua", source: "Cột «Khách hàng»", note: "Tên + SĐT nếu có" },
];

export function TaxExportTab() {
  const [from, setFrom] = useState(firstDayOfMonthStr);
  const [to, setTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await downloadTaxExportCsv({ from, to });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Tải xuất thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* CSV Export card */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/25">
            <Download className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Xuất CSV giao dịch</p>
            <Text className="mt-1 text-sm text-foreground/55">
              File CSV UTF-8 (BOM — tương thích Excel). Bao gồm tất cả đơn hàng trong kỳ với
              doanh thu, VAT% và thuế GTGT thực thu theo từng đơn.
            </Text>

            <div className="mt-5 flex flex-wrap items-end gap-4">
              <div className="w-72">
                <OrderDateRangePicker
                  label="Khoảng thời gian xuất"
                  from={from}
                  to={to}
                  onRangeChange={(f, t) => { setFrom(f); setTo(t); }}
                  className="w-full"
                />
              </div>
              <Button
                className="rounded-xl bg-[#1a3c34] px-5 font-semibold text-white shadow-md shadow-[#1a3c34]/20"
                onPress={handleDownload}
                isDisabled={loading}
              >
                <Download className="size-4" />
                {loading ? "Đang tải…" : "Tải xuống CSV"}
              </Button>
            </div>

            {error && (
              <Card className="mt-4 rounded-xl border border-red-200/80 bg-red-50">
                <CardContent className="px-4 py-2.5">
                  <Text className="text-sm text-red-700">{error}</Text>
                </CardContent>
              </Card>
            )}
            {success && (
              <Card className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50">
                <CardContent className="px-4 py-2.5">
                  <Text className="text-sm text-emerald-700">Tải xuống thành công.</Text>
                </CardContent>
              </Card>
            )}

            {/* Columns list */}
            <Card className="mt-5 rounded-xl border border-black/6 bg-[#f9fafb]">
              <CardContent className="p-4">
                <Text className="mb-2 text-xs font-semibold text-foreground/60">
                  Các cột trong file CSV
                </Text>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {CSV_COLUMNS.map((col) => (
                    <li key={col} className="flex items-center gap-2 text-xs text-foreground/60">
                      <span className="size-1.5 rounded-full bg-foreground/25 shrink-0" />
                      {col}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* E-invoice guide */}
      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/25">
            <FileText className="size-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Chuẩn bị hoá đơn điện tử (HĐĐT)</p>
            <Text className="mt-1 text-sm text-foreground/55">
              File CSV phù hợp để nạp vào phần mềm HĐĐT (MISA, FAST, VNPT Invoice, v.v.).
              Ánh xạ các trường bắt buộc với dữ liệu từ CSV:
            </Text>

            <Card className="mt-5 overflow-hidden rounded-xl border border-black/6">
              <Table.Root aria-label="Ánh xạ trường hoá đơn điện tử">
                <Table.ScrollContainer>
                  <Table.Content>
                    <Table.Header>
                      <Table.Column isRowHeader className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                        Trường HĐĐT
                      </Table.Column>
                      <Table.Column className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                        Lấy từ CSV
                      </Table.Column>
                      <Table.Column className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                        Ghi chú
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {INVOICE_FIELDS.map((row) => (
                        <Table.Row key={row.field}>
                          <Table.Cell className="px-4 py-2 text-xs font-medium text-foreground/80">
                            {row.field}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-2 text-xs text-foreground/60">
                            {row.source}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-2 text-xs text-foreground/40">
                            {row.note}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table.Root>
            </Card>

            <Card className="mt-4 rounded-xl border border-blue-200/60 bg-blue-50/60">
              <CardContent className="px-4 py-3">
                <Text className="text-xs text-blue-800">
                  <strong>Lưu ý:</strong> Thuế GTGT trong CSV phản ánh giá trị đã lưu tại thời điểm tạo đơn
                  theo cấu hình VAT hiệu lực lúc đó — không tính lại, đảm bảo nhất quán với sổ sách kế toán.
                </Text>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

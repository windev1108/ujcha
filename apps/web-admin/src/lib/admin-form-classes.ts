/**
 * Chuẩn form admin: label trên, control dưới, spacing đồng nhất.
 * Select trigger dùng flex + items-center; Select.Value thêm class căn dọc nội dung.
 */

/** Khối label + control (hoặc mô tả phía dưới control) */
export const adminFieldStack = "flex w-full min-w-0 flex-col gap-3";

/** Khoảng cách lớn hơn giữa các nhóm field trong modal / section */
export const adminFieldStackLoose = "flex w-full min-w-0 flex-col gap-4";

export const adminLabelClass =
  "block w-full shrink-0 text-xs font-semibold leading-snug text-foreground/70";

/** Label nhỏ trong bộ lọc (đơn hàng, v.v.) */
export const adminLabelClassFilter =
  "block w-full shrink-0 text-[10px] font-bold uppercase leading-snug tracking-wide text-foreground/45";

/** Label kiểu editor sản phẩm (uppercase nhẹ) */
export const adminLabelClassProduct =
  "block w-full shrink-0 text-xs font-semibold uppercase leading-snug tracking-wide text-foreground/60";

/** Nội dung đã chọn trong Select — căn giữa theo chiều dọc trong trigger */
export const adminSelectValueClass =
  "flex min-h-0 min-w-0 flex-1 items-center truncate text-left text-sm font-medium leading-none";

/** Select compact (toolbar / lọc) — cỡ chữ xs */
export const adminSelectValueCompactClass =
  "flex min-h-0 min-w-0 flex-1 items-center truncate text-left text-xs font-medium leading-none";

/** Select full — ô vuông bo góc (form chính) */
export const adminSelectTriggerClass =
  "flex h-11 min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium leading-none text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";

/** Select nhỏ — toolbar / lọc dạng pill (text căn giữa dọc) */
export const adminSelectTriggerCompactClass =
  "flex h-9 min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-medium leading-none text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]";

/** Input một dòng cao chuẩn */
export const adminInputClass =
  "h-11 rounded-xl border border-black/10 bg-white px-3 text-sm leading-none";

/** Select chỉnh sửa bàn (bo góc lớn, nền nhạt) */
export const adminSelectTriggerRoundedMutedClass =
  "flex h-11 min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-black/10 bg-[#f9fafb] px-3 text-sm font-medium leading-none text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]";

/** Select form tạo bàn mới (ô lớn, nền xám) */
export const adminSelectTriggerLargeSoftClass =
  "flex h-12 min-h-12 w-full items-center justify-between gap-2 rounded-2xl border-0 bg-[#f3f4f6] px-4 text-base leading-none ring-1 ring-black/6";

/** Giá trị hiển thị trong Select tạo bàn (text-base) */
export const adminSelectValueLargeClass =
  "flex min-h-0 min-w-0 flex-1 items-center truncate text-left text-base font-medium leading-none";

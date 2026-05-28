import fs from "node:fs";

const files = [
  "apps/web-admin/src/app/orders/components/NewOrderClient.tsx",
  "apps/web-admin/src/app/orders/components/OrderFilters.tsx",
  "apps/web-admin/src/app/orders/components/OrderEditModal.tsx",
  "apps/web-admin/src/app/orders/components/AssignShipperModal.tsx",
  "apps/web-admin/src/app/orders/components/PickupDateTimePicker.tsx",
  "apps/web-admin/src/app/orders/components/OrderDateRangePicker.tsx",
  "apps/web-admin/src/app/orders/components/pos/PosLineModal.tsx",
  "apps/web-admin/src/app/products/components/ProductEditorClient.tsx",
  "apps/web-admin/src/app/products/components/ProductsPageClient.tsx",
  "apps/web-admin/src/app/toppings/components/ToppingsPageClient.tsx",
  "apps/web-admin/src/app/toppings/components/ToppingFormModal.tsx",
  "apps/web-admin/src/app/shippers/components/ShippersPageClient.tsx",
  "apps/web-admin/src/app/shippers/components/ShipperFormModal.tsx",
  "apps/web-admin/src/app/tables/components/TablesPageClient.tsx",
  "apps/web-admin/src/app/tables/components/TableFormClient.tsx",
];

const TRIGGER_OLD =
  /className="h-11 min-h-11 rounded-xl border border-black\/10 bg-white px-3 text-sm"/g;
const TRIGGER_OLD2 =
  /className="h-10 w-full rounded-xl border border-black\/10 bg-white px-3 text-sm"/g;
const TRIGGER_OLD3 =
  /className="h-10 rounded-xl border border-black\/10 bg-white px-3 text-sm"/g;

for (const rel of files) {
  const p = new URL(`../${rel}`, import.meta.url);
  if (!fs.existsSync(p)) {
    console.warn("skip", rel);
    continue;
  }
  let t = fs.readFileSync(p, "utf8");
  const before = t;
  if (rel.includes("NewOrderClient")) {
    t = t.replace(TRIGGER_OLD, "className={adminSelectTriggerClass}");
    t = t.replace(
      /className="flex flex-col gap-2"/g,
      "className={adminFieldStack}",
    );
    t = t.replace(
      /className="flex min-w-0 flex-col gap-2"/g,
      "className={`min-w-0 ${adminFieldStack}`}",
    );
    t = t.replace(
      /lg:grid-cols-\[1fr_minmax\(200px,280px\)\] lg:items-end/g,
      "lg:grid-cols-[1fr_minmax(200px,280px)] lg:items-start",
    );
    t = t.replace(
      /<Label className="text-xs font-semibold text-foreground\/70">/g,
      "<Label className={adminLabelClass}>",
    );
  }
  if (rel.includes("OrderFilters")) {
    t = t.replace(
      /const selectTriggerClass =[\s\S]*?;/,
      `import {
  adminFieldStack,
  adminLabelClassFilter,
  adminSelectTriggerClass,
} from "@/lib/admin-form-classes";`,
    );
  }
  if (t !== before || rel.includes("OrderFilters")) {
    // OrderFilters needs manual edit - skip auto for OrderFilters in this script
  }
  if (!rel.includes("OrderFilters")) {
    if (t !== before) fs.writeFileSync(p, t);
  }
}

console.log("done");

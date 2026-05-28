import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../apps/web-admin/src/app/orders/components/NewOrderClient.tsx");
let t = fs.readFileSync(p, "utf8");
const o = t;
t = t.replace(
  /className="h-11 min-h-11 rounded-xl border border-black\/10 bg-white px-3 text-sm"/g,
  "className={adminSelectTriggerClass}",
);
t = t.replace(/className="flex flex-col gap-2"/g, "className={adminFieldStack}");
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
if (t === o) console.error("no changes");
else {
  fs.writeFileSync(p, t);
  console.error("written", p);
}

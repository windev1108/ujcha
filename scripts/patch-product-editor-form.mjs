import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../apps/web-admin/src/app/products/components/ProductEditorClient.tsx");
let t = fs.readFileSync(p, "utf8");
t = t.split('<div className="space-y-1.5">').join('<div className={adminFieldStack}>');
t = t.replace(
  /<Label className="text-xs font-semibold uppercase tracking-wide text-foreground\/60">/g,
  "<Label className={adminLabelClassProduct}>",
);
t = t.replace(
  /<Select\.Trigger className="w-full rounded-xl border border-black\/10 bg-white">/g,
  "<Select.Trigger className={adminSelectTriggerClass}>",
);
fs.writeFileSync(p, t);
console.error("ok", p);

"use client";

import { Modal, Button, useOverlayState } from "@heroui/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  MonitorDot,
  Puzzle,
  Settings2,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createAdminCategory } from "@/services/admin/categories-api";
import {
  fetchGrabMenu,
  pollGrabAuthRelay,
  pollGrabWebLogin,
  startGrabWebLogin,
} from "@/services/admin/grab-api";
import { createAdminProduct, fetchAdminProducts } from "@/services/admin/products-api";
import type {
  AdminCategory,
  CreateProductBody,
} from "@/services/admin/types";

// ─── GrabFood internal types ──────────────────────────────────────────────────

type GrabModifierItem = {
  modifierItemID: string;
  modifierItemName: string;
  priceInMin: number;
  nameTranslation: Record<string, string>;
  descriptionTranslation: Record<string, string>;
};

// Top-level modifierGroups (cùng cấp với categories trong response Grab)
type GrabModifierGroup = {
  modifierGroupID: string;
  modifierGroupName: string;
  nameTranslation: Record<string, string>;
  selectionRangeMin: number;
  selectionRangeMax: number;
  items: GrabModifierItem[];
};

type GrabCategory = {
  categoryID: string;
  categoryName: string;
  nameTranslation: Record<string, string>;
  items: GrabItem[];
};

type GrabItem = {
  itemID: string;
  itemName: string;
  imageURL?: string;
  priceInMin: number;
  description?: string;
  modifierGroupIDs: string[];
  nameTranslation: Record<string, string>;
  descriptionTranslation: Record<string, string>;
};

type GrabMenuData = {
  categories: GrabCategory[];
  modifierGroups: GrabModifierGroup[];
};

// ─── Normaliser ───────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Parse Grab's nameTranslation: { translation: { en, ko, zh } } → flat { en, ko, zh } */
function parseGrabTranslation(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const nt = (raw as Record<string, unknown>).translation;
  if (!nt || typeof nt !== "object") return out;
  for (const [locale, val] of Object.entries(nt as Record<string, unknown>)) {
    const v = typeof val === "string" ? val.trim() : "";
    if (v) out[locale] = v;
  }
  return out;
}


function normalizeModifierGroups(raw: unknown): GrabModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).flatMap((g) => {
    const id   = str(g.modifierGroupID) || str(g.modifierID) || str(g.id);
    const name = str(g.modifierGroupName) || str(g.modifierName) || str(g.name);
    if (!id || !name) return [];

    // Grab uses `modifiers` (not `items`/`modifierItems`) inside each group
    const rawItems = Array.isArray(g.modifiers) ? g.modifiers :
      Array.isArray(g.modifierItems) ? g.modifierItems :
      Array.isArray(g.items) ? g.items : [];

    const items: GrabModifierItem[] = (rawItems as Record<string, unknown>[]).flatMap((mi) => {
      const itemId   = str(mi.modifierItemID) || str(mi.modifierID) || str(mi.id);
      const itemName = str(mi.modifierItemName) || str(mi.modifierName) || str(mi.name);
      if (!itemId || !itemName) return [];
      const price = typeof mi.priceInMin === "number" ? mi.priceInMin :
        typeof mi.price === "number" ? mi.price : 0;
      const itemNt = parseGrabTranslation(mi.nameTranslation);
      const itemDt = parseGrabTranslation(mi.descriptionTranslation);
      return [{ modifierItemID: itemId, modifierItemName: itemName, priceInMin: price, nameTranslation: itemNt, descriptionTranslation: itemDt }];
    });

    const groupNt = parseGrabTranslation(g.nameTranslation);
    return [{
      modifierGroupID: id,
      modifierGroupName: name,
      nameTranslation: groupNt,
      selectionRangeMin: typeof g.selectionRangeMin === "number" ? g.selectionRangeMin : 0,
      selectionRangeMax: typeof g.selectionRangeMax === "number" ? g.selectionRangeMax : 1,
      items,
    }];
  });
}

function normalizeGrabMenu(raw: unknown): GrabMenuData {
  const root = (raw ?? {}) as Record<string, unknown>;

  // Top-level modifier groups (options/variants cho từng sản phẩm)
  const rawModGroups = Array.isArray(root.modifierGroups) ? root.modifierGroups as Record<string, unknown>[] : [];
  const modifierGroups = normalizeModifierGroups(rawModGroups);

  // Build reverse map: itemID → modifierGroupID[]  from relatedItemIDs on each group
  const itemToGroupIDs = new Map<string, string[]>();
  for (const rawG of rawModGroups) {
    const groupID = str(rawG.modifierGroupID) || str(rawG.modifierID) || str(rawG.id);
    if (!groupID) continue;
    const related = Array.isArray(rawG.relatedItemIDs) ? rawG.relatedItemIDs as unknown[] : [];
    for (const rid of related) {
      const itemID = str(rid); if (!itemID) continue;
      if (!itemToGroupIDs.has(itemID)) itemToGroupIDs.set(itemID, []);
      itemToGroupIDs.get(itemID)!.push(groupID);
    }
  }

  const rawCats = Array.isArray(root.categories)
    ? (root.categories as Record<string, unknown>[])
    : [];

  const categories: GrabCategory[] = [];

  for (const cat of rawCats) {
    const categoryID   = str(cat.categoryID) || str(cat.id) || str(cat.ID);
    const categoryName = str(cat.categoryName) || str(cat.name) || str(cat.Name);
    if (!categoryName) continue;

    // Pick whichever candidate field has the most entries (non-empty first)
    const candidateFields = [cat.menuItems, cat.items, cat.products, cat.productList];
    const rawItems = (() => {
      for (const f of candidateFields) {
        if (Array.isArray(f) && (f as unknown[]).length > 0) return f as Record<string, unknown>[];
      }
      for (const f of candidateFields) {
        if (Array.isArray(f)) return f as Record<string, unknown>[];
      }
      return [] as Record<string, unknown>[];
    })();

    const items: GrabItem[] = [];

    for (const item of rawItems) {
      const itemID   = str(item.itemID)   || str(item.id)   || str(item.ID);
      const itemName = str(item.itemName) || str(item.name) || str(item.Name);
      if (!itemID || !itemName) continue;

      let imageURL: string | undefined;
      if (str(item.imageURL))      imageURL = str(item.imageURL);
      else if (str(item.imageUrl)) imageURL = str(item.imageUrl);
      else if (Array.isArray(item.photos) && (item.photos as unknown[]).length > 0) {
        const p = (item.photos as Record<string, unknown>[])[0]!;
        imageURL = str(p.url) || str(p.URL) || undefined;
      }

      let priceInMin = 0;
      if (typeof item.priceInMin === "number") priceInMin = item.priceInMin;
      else if (typeof item.price === "number") priceInMin = item.price;
      else if (typeof item.priceInMin === "string") priceInMin = Number(item.priceInMin) || 0;

      // Parse references đến top-level modifierGroups (từ item hoặc từ relatedItemIDs trên group)
      const modGroupIDSet = new Set<string>();
      if (Array.isArray(item.modifierGroupIDs)) {
        for (const id of item.modifierGroupIDs as unknown[]) {
          const s = str(id); if (s) modGroupIDSet.add(s);
        }
      } else if (Array.isArray(item.modifierGroups)) {
        for (const g of item.modifierGroups as Record<string, unknown>[]) {
          const s = str(g.modifierGroupID) || str(g.id); if (s) modGroupIDSet.add(s);
        }
      }
      // Merge từ reverse map (relatedItemIDs trên mỗi group)
      for (const gid of itemToGroupIDs.get(itemID) ?? []) modGroupIDSet.add(gid);
      const modifierGroupIDs = [...modGroupIDSet];

      const nameTranslation = parseGrabTranslation(item.nameTranslation);
      const descriptionTranslation = parseGrabTranslation(item.descriptionTranslation);

      items.push({
        itemID,
        itemName,
        imageURL,
        priceInMin,
        description: str(item.description) || undefined,
        modifierGroupIDs,
        nameTranslation,
        descriptionTranslation,
      });
    }

    const catNt = parseGrabTranslation(cat.nameTranslation);
    categories.push({ categoryID: categoryID || categoryName, categoryName, nameTranslation: catNt, items });
  }

  console.log(`[GrabMenu] ${categories.length} cats, ${categories.reduce((n, c) => n + c.items.length, 0)} items, ${modifierGroups.length} modifier groups`);
  return { categories, modifierGroups };
}

const GRAB_LOGIN_URL =
  "https://weblogin.grab.com/merchant/login?service_id=MEXUSERS&redirect=https%3A%2F%2Fmerchant.grab.com%2Fportal";

// ─── Step machine ─────────────────────────────────────────────────────────────

type Step = "login" | "preview" | "importing" | "done";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categories: AdminCategory[];
  onImported: () => void;
}

interface ImportStatus {
  phase: string;
  done: number;
  total: number;
  failed: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export function GrabImportDialog({ isOpen, onOpenChange, categories, onImported }: Props) {
  const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost";
  const relayUrl   = typeof window !== "undefined"
    ? `${window.location.origin}/api/grab/auth-relay`
    : "/api/grab/auth-relay";
  const extensionUrl = typeof window !== "undefined"
    ? `${window.location.origin}/grab-extension`
    : "/grab-extension";

  const [step, setStep]             = useState<Step>("login");
  const [starting, setStarting]     = useState(false);
  const [loginError, setLoginError]  = useState<string | null>(null);
  const [fetchError, setFetchError]  = useState<string | null>(null);
  const [menuData, setMenuData]     = useState<GrabMenuData | null>(null);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [toppingCatIds, setToppingCatIds] = useState<Set<string>>(new Set());
  // Modifier groups the user manually promoted to optionGroups (overrides selectionRangeMin===0)
  const [forceOptionGroupIDs, setForceOptionGroupIDs] = useState<Set<string>>(new Set());
  const [showGroupClassifier, setShowGroupClassifier] = useState(true);
  const [status, setStatus]         = useState<ImportStatus>({ phase: "", done: 0, total: 0, failed: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStep("login"); setStarting(false);
    setLoginError(null); setFetchError(null);
    setMenuData(null); setSelected(new Set()); setExpandedCats(new Set());
    setToppingCatIds(new Set()); setForceOptionGroupIDs(new Set());
    setStatus({ phase: "", done: 0, total: 0, failed: 0 });
    setImportErrors([]); setSkippedCount(0);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => { if (!open) reset(); onOpenChange(open); },
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleStartLogin = async () => {
    setStarting(true); setLoginError(null);

    // Cloud (Vercel): open small centered popup + wait for postMessage from extension
    if (!isLocalDev) {
      const w = 520, h = 700;
      const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
      const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
      // Pass relay URL via window.name as fallback (for when window.opener is unavailable)
      window.open(
        GRAB_LOGIN_URL,
        relayUrl,
        `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
      );

      // Primary: postMessage from bookmarklet running on grab.com
      const handleMsg = (e: MessageEvent) => {
        if (e.data?.type !== "grab-session") return;
        if (typeof e.data.cookie !== "string" || !e.data.cookie) return;
        window.removeEventListener("message", handleMsg);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        void loadMenu(e.data.cookie as string);
      };
      window.addEventListener("message", handleMsg);

      // Fallback: poll auth-relay (user ran console script instead of bookmarklet)
      pollRef.current = setInterval(async () => {
        try {
          const r = await pollGrabAuthRelay();
          if (!r.ok) return;
          window.removeEventListener("message", handleMsg);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (r.cookie) void loadMenu(r.cookie);
        } catch { /* blip */ }
      }, 1500);
      return;
    }

    // Local dev: puppeteer opens Chrome window
    try {
      const { sessionId } = await startGrabWebLogin();
      pollRef.current = setInterval(async () => {
        try {
          const r = await pollGrabWebLogin(sessionId);
          if (r.status === "pending") return;
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (r.status === "error" || !r.cookie) {
            setLoginError(r.error ?? "Không lấy được cookie — thử lại");
            setStarting(false); return;
          }
          await loadMenu(r.cookie, r.merchantId, r.merchantGroupId);
        } catch { /* blip */ }
      }, 1500);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const loadMenu = async (cookie: string, mid?: string, mgid?: string) => {
    setFetchError(null);
    try {
      const raw = await fetchGrabMenu(cookie, mid, mgid);
      const data = normalizeGrabMenu(raw);
      const hasAnyItem = data.categories.some(c => c.items.length > 0);
      if (!hasAnyItem) {
        setFetchError("Không tìm thấy sản phẩm nào"); setStarting(false); return;
      }
      setMenuData(data);

      // Auto-select tất cả items (trừ categories rỗng)
      const all = new Set<string>();
      for (const cat of data.categories) for (const item of cat.items) all.add(item.itemID);
      setSelected(all);

      // Auto-detect topping categories theo tên
      const toppingIds = new Set(
        data.categories
          .filter(c => c.categoryName.toUpperCase().includes("TOPPING"))
          .map(c => c.categoryID)
      );
      setToppingCatIds(toppingIds);

      // Auto-detect optional modifier groups that are really option groups (not toppings)
      // by matching common Vietnamese café option keywords
      const OPTION_GROUP_KEYWORDS = [
        "mức đá", "mức đá", "ice", "đá",
        "ngọt", "đường", "sugar", "sweet",
        "kích cỡ", "size", "cỡ",
        "loại matcha", "loại trà", "loại sữa",
        "nhiệt độ", "nóng", "lạnh",
        "phần", "lượng",
      ];
      const autoOptionGroupIDs = new Set<string>(
        data.modifierGroups
          .filter(g => {
            if (g.selectionRangeMin >= 1) return false; // already required → optionGroup
            const name = g.modifierGroupName.toLowerCase();
            return OPTION_GROUP_KEYWORDS.some(kw => name.includes(kw));
          })
          .map(g => g.modifierGroupID)
      );
      setForceOptionGroupIDs(autoOptionGroupIDs);

      setExpandedCats(new Set(data.categories.filter(c => c.items.length > 0).map(c => c.categoryName)));
      setStarting(false); setStep("preview");
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e)); setStarting(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!menuData) return;
    setStep("importing");
    const errors: string[] = [];

    // Lookup map cho top-level modifierGroups
    const modGroupMap = new Map(menuData.modifierGroups.map(g => [g.modifierGroupID, g]));

    // Helper: resolve modifier groups for an item (all already populated via normalizeGrabMenu)
    const getItemModGroups = (item: GrabItem): GrabModifierGroup[] =>
      item.modifierGroupIDs
        .map(id => modGroupMap.get(id))
        .filter((g): g is GrabModifierGroup => !!g);

    // Phân loại items: sản phẩm vs topping category
    type ImportItem = { item: GrabItem; catName: string };
    const productItems: ImportItem[] = [];

    for (const cat of menuData.categories) {
      for (const item of cat.items) {
        if (!selected.has(item.itemID)) continue;
        if (!toppingCatIds.has(cat.categoryID)) {
          productItems.push({ item, catName: cat.categoryName });
        }
      }
    }

    const activeCatNames = [...new Set(productItems.map(x => x.catName))];

    // ── Phase 1: categories ───────────────────────────────────────────────
    setStatus({ phase: "Đang tạo danh mục…", done: 0, total: activeCatNames.length, failed: 0 });
    const catIdMap: Record<string, string> = {};
    for (const name of activeCatNames) {
      const ex = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (ex) {
        catIdMap[name] = ex.id;
      } else {
        const grabCat = menuData.categories.find(c => c.categoryName === name);
        const catNt = grabCat?.nameTranslation;
        try {
          const c = await createAdminCategory({
            name,
            ...(catNt && Object.keys(catNt).length ? { nameTranslation: catNt } : {}),
          });
          catIdMap[name] = c.id;
        } catch { if (categories[0]) catIdMap[name] = categories[0].id; }
      }
      setStatus(p => ({ ...p, done: p.done + 1 }));
    }

    // ── Phase 2: products (with inline optionGroups + toppings) ──────────
    // Pre-fetch existing GRAB SKUs to skip duplicates silently
    setStatus({ phase: "Kiểm tra sản phẩm đã có…", done: 0, total: 1, failed: 0 });
    const existingSKUs = new Set<string>();
    try {
      const existing = await fetchAdminProducts({ q: "GRAB-" });
      for (const p of existing) { if (p.sku) existingSKUs.add(p.sku); }
    } catch { /* ignore — will just try to create all */ }

    let skipped = 0;
    setStatus({ phase: "Đang nhập sản phẩm…", done: 0, total: productItems.length, failed: 0 });
    let failed = 0;

    for (const { item, catName } of productItems) {
      // Skip already-imported products silently
      if (existingSKUs.has(`GRAB-${item.itemID}`)) {
        skipped++;
        setStatus(p => ({ ...p, done: p.done + 1 }));
        continue;
      }
      const categoryId = catIdMap[catName];
      if (!categoryId) {
        failed++;
        setStatus(p => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
        continue;
      }

      const itemModGroups = getItemModGroups(item);

      // A group is an optionGroup if required (min>=1) OR manually forced by user
      const isOptionGrp = (g: GrabModifierGroup) =>
        g.selectionRangeMin >= 1 || forceOptionGroupIDs.has(g.modifierGroupID);

      const optionGroups = itemModGroups
        .filter(isOptionGrp)
        .map(g => ({
          id: g.modifierGroupID,
          name: g.modifierGroupName,
          ...(Object.keys(g.nameTranslation).length ? { nameTranslation: g.nameTranslation } : {}),
          selectionMin: g.selectionRangeMin,
          selectionMax: g.selectionRangeMax,
          values: g.items.map(v => ({
            label: v.modifierItemName,
            priceDelta: v.priceInMin,
            ...(Object.keys(v.nameTranslation).length ? { nameTranslation: v.nameTranslation } : {}),
            ...(Object.keys(v.descriptionTranslation).length ? { descriptionTranslation: v.descriptionTranslation } : {}),
          })),
        }));

      const toppings = itemModGroups
        .filter(g => !isOptionGrp(g))
        .flatMap(g => g.items.map(ti => ({
          id: ti.modifierItemID,
          name: ti.modifierItemName,
          ...(Object.keys(ti.nameTranslation).length ? { nameTranslation: ti.nameTranslation } : {}),
          ...(Object.keys(ti.descriptionTranslation).length ? { descriptionTranslation: ti.descriptionTranslation } : {}),
          price: ti.priceInMin,
          isActive: true,
        })));

      const body: CreateProductBody = {
        categoryId,
        name: item.itemName,
        sku: `GRAB-${item.itemID}`,
        description: item.description || undefined,
        price: item.priceInMin,
        imageUrls: item.imageURL ? [item.imageURL] : [],
        nameTranslation: Object.keys(item.nameTranslation).length > 0 ? item.nameTranslation : undefined,
        descriptionTranslation: Object.keys(item.descriptionTranslation).length > 0 ? item.descriptionTranslation : undefined,
        optionGroups: optionGroups.length > 0 ? optionGroups : undefined,
        toppings: toppings.length > 0 ? toppings : undefined,
        isAvailable: true,
        isSoldOut: false,
      };
      try {
        await createAdminProduct(body);
        setStatus(p => ({ ...p, done: p.done + 1 }));
      } catch (e: unknown) {
        failed++;
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? item.itemName;
        errors.push(String(msg));
        setStatus(p => ({ ...p, done: p.done + 1, failed: p.failed + 1 }));
      }
    }

    setImportErrors(errors);
    setSkippedCount(skipped);
    setStatus(p => ({ ...p, failed, total: p.total - skipped }));
    setStep("done");
    if (productItems.length - failed - skipped > 0) onImported();
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalItems = useMemo(
    () => menuData?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0,
    [menuData],
  );

  // Lookup map for resolving modifier groups in the preview
  const modGroupMap = useMemo(
    () => new Map((menuData?.modifierGroups ?? []).map(g => [g.modifierGroupID, g])),
    [menuData],
  );

  const { productSelected, toppingSelected } = useMemo(() => {
    if (!menuData) return { productSelected: 0, toppingSelected: 0 };
    let ps = 0, ts = 0;
    for (const cat of menuData.categories) {
      const isTopping = toppingCatIds.has(cat.categoryID);
      for (const item of cat.items) {
        if (selected.has(item.itemID)) isTopping ? ts++ : ps++;
      }
    }
    return { productSelected: ps, toppingSelected: ts };
  }, [menuData, selected, toppingCatIds]);

  const toggleItem = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const toggleCat = (cat: GrabCategory) => {
    const ids = cat.items.map(i => i.itemID);
    const allSel = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allSel ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleExpand = (catName: string) => setExpandedCats(prev => {
    const next = new Set(prev); next.has(catName) ? next.delete(catName) : next.add(catName); return next;
  });

  const toggleToppingCat = (catId: string) => setToppingCatIds(prev => {
    const next = new Set(prev); next.has(catId) ? next.delete(catId) : next.add(catId); return next;
  });

  const heading = {
    login:     "Kết nối GrabFood",
    preview:   `Chọn sản phẩm (${totalItems} món)`,
    importing: "Đang nhập…",
    done:      "Nhập xong",
  }[step];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal.Root state={modalState}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="flex max-h-[90vh] max-w-2xl flex-col rounded-2xl border border-black/6 p-0 shadow-xl">

            {/* ── Header ── */}
            <Modal.Header className="shrink-0 border-b border-black/8 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">GrabFood Integration</p>
              <Modal.Heading className="mt-0.5 text-lg font-bold text-[#1a3c34]">{heading}</Modal.Heading>
            </Modal.Header>

            {/* ── Body ── */}
            <Modal.Body className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

              {/* login idle */}
              {step === "login" && !starting && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 rounded-2xl bg-[#f0f7f4] p-5">
                    <MonitorDot className="mt-0.5 size-5 shrink-0 text-[#1a3c34]" />
                    <p className="text-sm text-foreground/70">
                      Một cửa sổ Chrome sẽ mở ra. Đăng nhập tài khoản GrabFood merchant, rồi bấm nút xanh{" "}
                      <strong className="text-[#00b14f]">"Xác nhận đã đăng nhập — Lấy session"</strong>.
                    </p>
                  </div>

                  {/* Extension notice — only on cloud */}
                  {!isLocalDev && (
                    <div className="flex items-start gap-3 rounded-2xl border border-[#1a3c34]/15 bg-white p-4">
                      <Puzzle className="mt-0.5 size-4 shrink-0 text-[#1a3c34]" />
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">Cần cài Extension Chrome (1 lần duy nhất)</p>
                        <p className="mt-0.5 text-xs text-foreground/55">
                          Extension tự động inject nút xanh vào trang GrabFood — không cần thao tác thêm.
                        </p>
                        <ol className="mt-2 space-y-1 text-xs text-foreground/70">
                          <li>1. <a href={extensionUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1a3c34] underline-offset-2 hover:underline inline-flex items-center gap-0.5">Tải thư mục extension <ExternalLink className="size-2.5" /></a></li>
                          <li>2. Mở <code className="rounded bg-black/6 px-1">chrome://extensions</code> → bật <strong>Developer mode</strong></li>
                          <li>3. Bấm <strong>Load unpacked</strong> → chọn thư mục vừa tải</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {(loginError ?? fetchError) && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {loginError ?? fetchError}
                    </div>
                  )}
                </div>
              )}

              {/* login waiting — local dev */}
              {step === "login" && starting && isLocalDev && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-[#f0f7f4]">
                    <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Cửa sổ Chrome đã mở</p>
                    <p className="mt-1.5 text-sm text-foreground/55">
                      Đăng nhập xong → bấm nút xanh{" "}
                      <strong className="text-[#00b14f]">"Xác nhận đã đăng nhập"</strong>
                    </p>
                  </div>
                  {fetchError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {fetchError}
                    </div>
                  )}
                </div>
              )}

              {/* login waiting — cloud/Vercel */}
              {step === "login" && starting && !isLocalDev && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-[#f0f7f4]">
                    <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Cửa sổ GrabFood đã mở</p>
                    <p className="mt-1.5 text-sm text-foreground/55">
                      Đăng nhập xong → bấm nút xanh{" "}
                      <strong className="text-[#00b14f]">"Xác nhận đã đăng nhập"</strong>{" "}
                      trên trang GrabFood
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const w = 520, h = 700;
                        const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
                        const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
                        window.open(GRAB_LOGIN_URL, relayUrl,
                          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`);
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3c34] underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="size-3" /> Mở lại cửa sổ
                    </button>
                  </div>
                  {fetchError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {fetchError}
                    </div>
                  )}
                </div>
              )}

              {/* preview */}
              {step === "preview" && menuData && (
                <div className="flex flex-col gap-4">

                  {/* ── Stats bar ── */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#f0f7f4] p-3 text-center">
                      <p className="text-lg font-bold text-[#1a3c34]">{menuData.categories.length}</p>
                      <p className="text-[10px] text-foreground/50">Tổng danh mục</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{productSelected}</p>
                      <p className="text-[10px] text-green-600">Sản phẩm chọn</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{toppingSelected}</p>
                      <p className="text-[10px] text-amber-600">Topping chọn</p>
                    </div>
                  </div>

                  {/* Chọn tất cả / Bỏ chọn */}
                  <div className="flex items-center justify-between rounded-xl bg-[#f0f7f4] px-4 py-2.5">
                    <span className="text-sm text-foreground/70">
                      <strong className="text-foreground">{selected.size}</strong>/{totalItems} món được chọn
                    </span>
                    <div className="flex gap-3 text-xs">
                      <button type="button" onClick={() => setSelected(new Set(menuData.categories.flatMap(c => c.items.map(i => i.itemID))))} className="font-semibold text-[#1a3c34] hover:underline">Chọn tất cả</button>
                      <button type="button" onClick={() => setSelected(new Set())} className="text-foreground/45 hover:underline">Bỏ chọn</button>
                    </div>
                  </div>

                  {/* Topping auto-detect notice */}
                  {toppingCatIds.size > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <UtensilsCrossed className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Phát hiện {toppingCatIds.size} danh mục Topping — sẽ import là topping thay vì sản phẩm.
                        Bấm{" "}<strong>→ Sản phẩm</strong> trên từng danh mục để thay đổi.
                      </span>
                    </div>
                  )}

                  {/* Auto-create notice */}
                  {menuData.categories.some(cat =>
                    cat.items.length > 0 &&
                    !toppingCatIds.has(cat.categoryID) &&
                    !categories.find(c => c.name.toLowerCase() === cat.categoryName.toLowerCase())
                  ) && (
                    <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      <Tag className="mt-0.5 size-3.5 shrink-0" />
                      Danh mục sản phẩm chưa có trong UjCha sẽ được tạo tự động khi import.
                    </div>
                  )}

                  {/* ── Modifier group classifier ── */}
                  {menuData.modifierGroups.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-black/8">
                      <button
                        type="button"
                        onClick={() => setShowGroupClassifier(v => !v)}
                        className="flex w-full items-center justify-between bg-[#f5f5f5] px-4 py-2.5 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Settings2 className="size-3.5 text-[#1a3c34]" />
                          <span className="text-xs font-bold text-foreground">Phân loại nhóm tùy chọn</span>
                          <span className="rounded-full bg-[#1a3c34]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1a3c34]">
                            {menuData.modifierGroups.length} nhóm
                          </span>
                        </div>
                        {showGroupClassifier ? <ChevronDown className="size-3.5 text-foreground/40" /> : <ChevronRight className="size-3.5 text-foreground/40" />}
                      </button>

                      {showGroupClassifier && (
                        <div className="divide-y divide-black/[0.04]">
                          {menuData.modifierGroups.map(g => {
                            const isRequired = g.selectionRangeMin >= 1;
                            const isForced   = forceOptionGroupIDs.has(g.modifierGroupID);
                            const isOpt      = isRequired || isForced;

                            return (
                              <div key={g.modifierGroupID} className="flex items-center gap-3 px-4 py-2">
                                {/* Group info */}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-foreground">{g.modifierGroupName}</p>
                                  <p className="text-[10px] text-foreground/45">{g.items.length} lựa chọn · min {g.selectionRangeMin} / max {g.selectionRangeMax}</p>
                                </div>

                                {/* Type badge */}
                                {isRequired ? (
                                  <span className="shrink-0 rounded-full bg-[#1a3c34]/8 px-2 py-0.5 text-[10px] font-semibold text-[#1a3c34]">
                                    Biến thể · bắt buộc
                                  </span>
                                ) : isForced ? (
                                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    Biến thể · tùy chọn
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    Topping
                                  </span>
                                )}

                                {/* Toggle — only for optional groups */}
                                {!isRequired && (
                                  <button
                                    type="button"
                                    onClick={() => setForceOptionGroupIDs(prev => {
                                      const next = new Set(prev);
                                      next.has(g.modifierGroupID) ? next.delete(g.modifierGroupID) : next.add(g.modifierGroupID);
                                      return next;
                                    })}
                                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${
                                      isForced
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-blue-200 bg-blue-50 text-blue-700"
                                    }`}
                                  >
                                    {isForced ? "→ Topping" : "→ Biến thể"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Category list ── */}
                  <div className="flex flex-col gap-2">
                    {menuData.categories.map(cat => {
                      const isEmpty     = cat.items.length === 0;
                      const isTopping   = toppingCatIds.has(cat.categoryID);
                      const catItems    = cat.items;
                      const allSel      = !isEmpty && catItems.every(i => selected.has(i.itemID));
                      const someSel     = catItems.some(i => selected.has(i.itemID));
                      const expanded    = expandedCats.has(cat.categoryName);
                      const existingCat = categories.find(c => c.name.toLowerCase() === cat.categoryName.toLowerCase());

                      // Color scheme per category type
                      const headerBg = isEmpty
                        ? "bg-[#fafafa] opacity-60"
                        : isTopping
                        ? "bg-amber-50/70"
                        : "bg-[#fafafa]";

                      return (
                        <div key={cat.categoryID} className={`overflow-hidden rounded-xl border bg-white ${isEmpty ? "border-black/6 opacity-70" : isTopping ? "border-amber-200" : "border-black/8"}`}>

                          {/* Category header row */}
                          <div className={`flex items-center gap-2.5 px-4 py-2.5 ${headerBg}`}>

                            {/* Checkbox — disabled for empty */}
                            {!isEmpty ? (
                              <button
                                type="button"
                                onClick={() => toggleCat(cat)}
                                className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition ${allSel ? "border-[#1a3c34] bg-[#1a3c34]" : someSel ? "border-[#1a3c34]/60 bg-[#1a3c34]/10" : "border-black/20 bg-white"}`}
                              >
                                {allSel && <span className="text-[9px] font-bold text-white">✓</span>}
                                {!allSel && someSel && <span className="text-[9px] font-bold text-[#1a3c34]">—</span>}
                              </button>
                            ) : (
                              <div className="flex size-5 shrink-0 items-center justify-center rounded border-2 border-black/10 bg-black/5 cursor-not-allowed" />
                            )}

                            {/* Name + count */}
                            <p className={`flex-1 text-sm font-bold ${isEmpty ? "text-foreground/40" : "text-foreground"}`}>
                              {cat.categoryName}
                              <span className="ml-2 text-xs font-normal text-foreground/40">({catItems.length} món)</span>
                            </p>

                            {/* Status badges */}
                            <div className="flex items-center gap-1.5">
                              {/* Type badge */}
                              {isEmpty ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">Trống</span>
                              ) : isTopping ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">🍡 Topping</span>
                              ) : existingCat ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">↔ {existingCat.name}</span>
                              ) : (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">+ Tạo mới</span>
                              )}

                              {/* Toggle topping/product — only for non-empty cats */}
                              {!isEmpty && (
                                <button
                                  type="button"
                                  onClick={() => toggleToppingCat(cat.categoryID)}
                                  title={isTopping ? "Chuyển sang Sản phẩm" : "Chuyển sang Topping"}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${
                                    isTopping
                                      ? "border-green-200 bg-green-50 text-green-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {isTopping ? "→ Sản phẩm" : "→ Topping"}
                                </button>
                              )}
                            </div>

                            {/* Expand toggle — only for non-empty */}
                            {!isEmpty ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(cat.categoryName)}
                                className="ml-0.5 rounded-full p-0.5 text-foreground/35 transition hover:bg-black/8 hover:text-foreground/70"
                              >
                                {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </button>
                            ) : (
                              <div className="size-5 ml-0.5" />
                            )}
                          </div>

                          {/* Items list */}
                          {!isEmpty && expanded && (
                            <div className="divide-y divide-black/[0.04]">
                              {catItems.map(item => {
                                const checked   = selected.has(item.itemID);
                                const resolvedGroups = item.modifierGroupIDs
                                  .map(id => modGroupMap.get(id))
                                  .filter((g): g is GrabModifierGroup => !!g);
                                // Respect user classification overrides
                                const optionMods  = resolvedGroups.filter(g => g.selectionRangeMin >= 1 || forceOptionGroupIDs.has(g.modifierGroupID));
                                const toppingMods = resolvedGroups.filter(g => g.selectionRangeMin === 0 && !forceOptionGroupIDs.has(g.modifierGroupID));
                                const allToppingItems = toppingMods.flatMap(g => g.items);

                                return (
                                  <div
                                    key={item.itemID}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === " " || e.key === "Enter") toggleItem(item.itemID); }}
                                    onClick={() => toggleItem(item.itemID)}
                                    className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 transition ${checked ? (isTopping ? "bg-amber-50/50" : "bg-[#1a3c34]/[0.025]") : "hover:bg-black/[0.015]"}`}
                                  >
                                    {/* Checkbox */}
                                    <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 transition ${checked ? (isTopping ? "border-amber-500 bg-amber-500" : "border-[#1a3c34] bg-[#1a3c34]") : "border-black/20 bg-white"}`}>
                                      {checked && <span className="text-[8px] font-bold text-white">✓</span>}
                                    </div>

                                    {/* Image */}
                                    {item.imageURL ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.imageURL}
                                        alt={item.itemName}
                                        className="size-11 shrink-0 rounded-lg object-cover ring-1 ring-black/8"
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                      />
                                    ) : (
                                      <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-base ${isTopping ? "bg-amber-50" : "bg-[#f3f4f6]"}`}>
                                        {isTopping ? "🍡" : "🍵"}
                                      </div>
                                    )}

                                    {/* Info */}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-foreground">{item.itemName}</p>
                                      {item.description && (
                                        <p className="mt-0.5 line-clamp-1 text-xs text-foreground/45">{item.description}</p>
                                      )}

                                      {/* Topping category → just show "Topping" label, no modifier groups */}
                                      {isTopping && (
                                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                          <UtensilsCrossed className="size-2.5" />
                                          Nhập làm Topping
                                        </span>
                                      )}

                                      {/* Product category → show options & toppings from modifiers */}
                                      {!isTopping && (
                                        <>
                                          {optionMods.length > 0 && (
                                            <div className="mt-1.5 flex flex-col gap-1">
                                              {optionMods.map(g => (
                                                <div key={g.modifierGroupID} className="flex flex-wrap items-center gap-1">
                                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1a3c34]/8 px-2 py-0.5 text-[10px] font-bold text-[#1a3c34]">
                                                    <Settings2 className="size-2.5" />
                                                    {g.modifierGroupName}
                                                  </span>
                                                  {g.items.map(v => (
                                                    <span key={v.modifierItemID} className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] text-foreground/65">
                                                      {v.modifierItemName}{v.priceInMin > 0 ? ` +${v.priceInMin.toLocaleString("vi-VN")}₫` : ""}
                                                    </span>
                                                  ))}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {allToppingItems.length > 0 && (
                                            <div className="mt-1 flex flex-wrap items-center gap-1">
                                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                <UtensilsCrossed className="size-2.5" />
                                                Topping
                                              </span>
                                              {allToppingItems.map(ti => (
                                                <span key={ti.modifierItemID} className="rounded-full border border-amber-100 bg-amber-50/60 px-2 py-0.5 text-[10px] text-amber-800">
                                                  {ti.modifierItemName}{ti.priceInMin > 0 ? ` +${ti.priceInMin.toLocaleString("vi-VN")}₫` : ""}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {/* Price */}
                                    <p className={`mt-0.5 shrink-0 text-sm font-bold tabular-nums ${isTopping ? "text-amber-700" : "text-[#1a3c34]"}`}>
                                      {item.priceInMin > 0 ? item.priceInMin.toLocaleString("vi-VN") + "₫" : "—"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* importing */}
              {step === "importing" && (
                <div className="flex flex-col items-center gap-6 py-8">
                  <Loader2 className="size-10 animate-spin text-[#1a3c34]" />
                  <div className="w-full max-w-xs text-center">
                    <p className="mb-3 text-sm font-semibold text-foreground">{status.phase}</p>
                    <div className="h-2 overflow-hidden rounded-full bg-black/8">
                      <div
                        className="h-full rounded-full bg-[#1a3c34] transition-all duration-200"
                        style={{ width: status.total > 0 ? `${(status.done / status.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-foreground/50">{status.done} / {status.total}</p>
                    {status.failed > 0 && <p className="mt-1 text-xs text-red-500">{status.failed} lỗi</p>}
                  </div>
                  <p className="text-xs text-foreground/35">Vui lòng không đóng cửa sổ này…</p>
                </div>
              )}

              {/* done */}
              {step === "done" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <CheckCircle2 className="size-12 text-emerald-500" />
                  <div className="text-center">
                    <p className="text-lg font-bold">Đã nhập {status.total - status.failed} mục thành công</p>
                    {skippedCount > 0 && <p className="mt-1 text-sm text-foreground/50">{skippedCount} sản phẩm bỏ qua (đã tồn tại)</p>}
                    {status.failed > 0 && <p className="mt-1 text-sm text-red-600">{status.failed} lỗi</p>}
                  </div>
                  {importErrors.length > 0 && (
                    <div className="w-full rounded-xl border border-red-100 bg-red-50 p-3">
                      <p className="mb-1.5 text-xs font-semibold text-red-700">Chi tiết lỗi:</p>
                      <ul className="space-y-0.5 text-xs text-red-600">{importErrors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>

            {/* ── Footer ── */}
            <Modal.Footer className="shrink-0 flex items-center justify-between border-t border-black/8 px-6 py-4">
              {step === "login" && !starting && (
                <>
                  <Button variant="ghost" onPress={() => onOpenChange(false)} className="rounded-full">Hủy</Button>
                  <Button onPress={() => void handleStartLogin()} className="rounded-full bg-[#1a3c34] font-semibold text-white">
                    Mở cửa sổ đăng nhập GrabFood →
                  </Button>
                </>
              )}
              {step === "login" && starting && (
                <div className="flex w-full items-center justify-between">
                  <Button variant="ghost" onPress={() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setStarting(false); }} className="rounded-full text-foreground/50">Hủy</Button>
                  <span className="text-sm text-foreground/40">Đang chờ bạn bấm nút xanh trong Chrome…</span>
                </div>
              )}
              {step === "preview" && (
                <>
                  <Button variant="ghost" onPress={() => setStep("login")} className="rounded-full">← Quay lại</Button>
                  <Button
                    isDisabled={selected.size === 0}
                    onPress={() => void handleImport()}
                    className="rounded-full bg-[#1a3c34] font-semibold text-white"
                  >
                    Nhập {productSelected > 0 ? `${productSelected} sp` : ""}
                    {productSelected > 0 && toppingSelected > 0 ? " · " : ""}
                    {toppingSelected > 0 ? `${toppingSelected} topping` : ""} →
                  </Button>
                </>
              )}
              {step === "importing" && <div className="w-full text-center text-xs text-foreground/40">Đang xử lý…</div>}
              {step === "done" && (
                <Button onPress={() => { reset(); onOpenChange(false); }} className="ml-auto rounded-full bg-[#1a3c34] font-semibold text-white">Hoàn thành</Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

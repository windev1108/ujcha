"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input, Label } from "@heroui/react";
import { useTranslations } from "next-intl";
import {
  useAddressesQuery,
  useCreateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  useUpdateAddressMutation,
} from "@/services/order/hooks";
import { revealTransition, easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { UserAddress } from "@/services/order/api";
import { AddressAutocompleteInput } from "@/components/common/AddressAutocompleteInput";
import { DA_NANG_BOUNDING_BOX, DA_NANG_QUERY_SUFFIX } from "@/lib/constants";

const MapLocationPicker = dynamic(
  () =>
    import("@/app/[locale]/checkout/components/MapLocationPicker").then((m) => ({
      default: m.MapLocationPicker,
    })),
  { ssr: false },
);

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
      { headers: { "User-Agent": "KunRituals/1.0" } },
    );
    const data = (await resp.json()) as { display_name?: string };
    return data.display_name ?? "";
  } catch {
    return "";
  }
}

const MAX_ADDRESSES = 3;

const inputClass =
  "min-h-12 w-full rounded-xl border-0 bg-kun-filter-pill-bg px-4 text-sm ring-1 ring-black/6 focus-visible:ring-2 focus-visible:ring-kun-products-forest/40";

interface AddressForm {
  fullAddress: string;
  lat: number | null;
  lng: number | null;
  note: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  fullAddress: "",
  lat: null,
  lng: null,
  note: "",
  isDefault: false,
};

function addressToForm(addr: UserAddress): AddressForm {
  return {
    fullAddress: addr.fullAddress,
    lat: addr.lat,
    lng: addr.lng,
    note: addr.note ?? "",
    isDefault: addr.isDefault,
  };
}

// ── AddressCard ───────────────────────────────────────────────────────────────

function AddressCard({
  address,
  onEdit,
  onSetDefault,
  onDelete,
  settingDefault,
  deleting,
}: {
  address: UserAddress;
  onEdit: (addr: UserAddress) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  settingDefault: boolean;
  deleting: boolean;
}) {
  const t = useTranslations();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: easeOutSmooth }}
      className="rounded-3xl border border-black/6 bg-white p-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-kun-sage/15 text-kun-products-forest">
          <MapPin className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground leading-snug">
              {address.fullAddress}
            </p>
            {address.isDefault && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 flex items-center gap-1">
                <Star className="size-2.5 fill-amber-500 text-amber-500" />
                {t("default")}
              </span>
            )}
          </div>
          {address.note && (
            <p className="mt-1 text-xs text-foreground/50">{address.note}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onEdit(address)}
          className="shrink-0 flex size-7 items-center justify-center rounded-full hover:bg-black/5 text-foreground/40 hover:text-foreground/70 transition-colors"
          aria-label={t("edit")}
        >
          <Pencil className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3">
        {!address.isDefault ? (
          <button
            type="button"
            onClick={() => onSetDefault(address.id)}
            disabled={settingDefault}
            className="flex items-center gap-1.5 text-xs font-medium text-kun-products-forest hover:opacity-80 disabled:opacity-50"
          >
            {settingDefault ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {t("set_as_default")}
          </button>
        ) : (
          <span className="text-xs text-foreground/40">{t("default_address")}</span>
        )}

        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-foreground/50 hover:text-foreground"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(address.id)}
                disabled={deleting}
                className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                {t("confirm_delete")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-foreground/40 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
              {t("delete")}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── AddressModal (shared for add + edit) ──────────────────────────────────────

function AddressModal({
  open,
  title,
  initialForm,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  title: string;
  initialForm: AddressForm;
  onClose: () => void;
  onSubmit: (form: AddressForm) => void;
  submitting: boolean;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<AddressForm>(initialForm);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  function patch(p: Partial<AddressForm>) {
    setForm((prev) => ({ ...prev, ...p }));
    const touched = Object.keys(p) as (keyof AddressForm)[];
    setErrors((e) => {
      const next = { ...e };
      touched.forEach((k) => delete next[k]);
      return next;
    });
  }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setGeoError(t("browser_no_location"));
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        patch({ lat, lng });
        const address = await reverseGeocode(lat, lng);
        setGeoLoading(false);
        if (address) patch({ fullAddress: address });
      },
      () => {
        setGeoLoading(false);
        setGeoError(t("location_permission_denied"));
      },
      { timeout: 10_000 },
    );
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.fullAddress.trim()) next.fullAddress = t("address_required");
    if (form.lat == null || form.lng == null) next.lat = t("gps_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  }

  function handleClose() {
    setForm(initialForm);
    setErrors({});
    setGeoError(null);
    setShowMap(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {showMap && (
        <MapLocationPicker
          initialLat={form.lat}
          initialLng={form.lng}
          onConfirm={(lat, lng, address) => {
            patch({ lat, lng, fullAddress: address });
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.3, ease: easeOutSmooth }}
        className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-full hover:bg-black/5 text-foreground/50"
            aria-label={t("close")}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground/70">{t("full_address")}</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-kun-products-forest hover:opacity-80"
                >
                  <Map className="size-3" />
                  {t("select_on_map")}
                </button>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={geoLoading}
                  className="flex items-center gap-1 text-[11px] font-medium text-kun-products-forest hover:opacity-80 disabled:opacity-50"
                >
                  {geoLoading ? <Loader2 className="size-3 animate-spin" /> : <Navigation className="size-3" />}
                  {t("gps")}
                </button>
              </div>
            </div>
            <AddressAutocompleteInput
              value={form.fullAddress}
              onChange={(v) => patch({ fullAddress: v })}
              onSelect={(s) => patch({ fullAddress: s.displayName, lat: s.lat, lng: s.lng })}
              placeholder={t("address_placeholder")}
              className={inputClass}
              autoComplete="street-address"
              boundingBox={DA_NANG_BOUNDING_BOX}
              querySuffix={DA_NANG_QUERY_SUFFIX}
            />
            {errors.fullAddress && <p className="mt-1 text-xs text-red-500">{errors.fullAddress}</p>}
            {geoError && <p className="mt-1 text-xs text-red-500">{geoError}</p>}
            {/* {form.lat != null && form.lng != null && (
              <p className="mt-1 text-xs text-kun-products-forest">
                GPS: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </p>
            )} */}
            {errors.lat && !geoError && <p className="mt-1 text-xs text-red-500">{errors.lat}</p>}
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-foreground/70">{t("note_optional")}</Label>
            <Input
              placeholder={t("address_note_placeholder")}
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              className={inputClass}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              role="checkbox"
              aria-checked={form.isDefault}
              onClick={() => patch({ isDefault: !form.isDefault })}
              className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${form.isDefault ? "border-kun-products-forest bg-kun-products-forest" : "border-black/20 bg-white"
                }`}
            >
              {form.isDefault && (
                <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-foreground/75">{t("set_as_default_address")}</span>
          </label>

          <Button
            type="submit"
            isDisabled={submitting}
            className="mt-2 w-full rounded-full bg-kun-products-forest text-white font-semibold h-12 disabled:opacity-60"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t("saving")}
              </span>
            ) : (
              t("save_address")
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Page Shell ────────────────────────────────────────────────────────────────

export function AddressesPageShell() {
  const t = useTranslations();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useAddressesQuery();
  const createMutation = useCreateAddressMutation();
  const updateMutation = useUpdateAddressMutation();
  const deleteMutation = useDeleteAddressMutation();
  const setDefaultMutation = useSetDefaultAddressMutation();

  const isAtLimit = addresses.length >= MAX_ADDRESSES;

  async function handleCreate(form: AddressForm) {
    if (form.lat == null || form.lng == null) return;
    await createMutation.mutateAsync({
      fullAddress: form.fullAddress.trim(),
      lat: form.lat,
      lng: form.lng,
      note: form.note.trim() || undefined,
      isDefault: form.isDefault,
    });
    setShowAddModal(false);
  }

  async function handleUpdate(form: AddressForm) {
    if (!editingAddress || form.lat == null || form.lng == null) return;
    await updateMutation.mutateAsync({
      id: editingAddress.id,
      payload: {
        fullAddress: form.fullAddress.trim(),
        lat: form.lat,
        lng: form.lng,
        note: form.note.trim() || undefined,
        isDefault: form.isDefault || undefined,
      },
    });
    setEditingAddress(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id);
    try {
      await setDefaultMutation.mutateAsync(id);
    } finally {
      setSettingDefaultId(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          className="mb-6"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            {t("account")}
          </p>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("shipping_addresses")}
            </h1>
            <div className="flex flex-col items-end gap-1">
              <Button
                onPress={() => setShowAddModal(true)}
                isDisabled={isAtLimit}
                className="flex items-center gap-1.5 rounded-full bg-kun-products-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-4" />
                {t("add_new")}
              </Button>
              {isAtLimit && (
                <p className="text-[11px] text-foreground/45">{t("max_3_addresses")}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={revealTransition}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-white shadow-sm">
              <MapPin className="size-7 text-foreground/30" />
            </div>
            <p className="mt-4 font-semibold text-foreground">{t("no_address")}</p>
            <p className="mt-1 text-sm text-foreground/50">{t("address_save_desc")}</p>
            <Button
              onPress={() => setShowAddModal(true)}
              className="mt-6 flex items-center gap-2 rounded-full bg-kun-products-forest px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="size-4" />
              {t("add_first_address")}
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  onEdit={setEditingAddress}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                  settingDefault={settingDefaultId === addr.id}
                  deleting={deletingId === addr.id}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddressModal
            open={showAddModal}
            title={t("add_new_address")}
            initialForm={EMPTY_FORM}
            onClose={() => setShowAddModal(false)}
            onSubmit={handleCreate}
            submitting={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingAddress && (
          <AddressModal
            open={!!editingAddress}
            title={t("edit_address")}
            initialForm={addressToForm(editingAddress)}
            onClose={() => setEditingAddress(null)}
            onSubmit={handleUpdate}
            submitting={updateMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Plus,
  User,
  Utensils,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CheckoutTabId } from "./checkout-tab";
import { CHECKOUT_TAB } from "./checkout-tab";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { DeliveryForm, PickupForm } from "./checkout-types";
import type { UserAddress } from "@/services/order/api";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "@/i18n/navigation";
import { PickupScheduler } from "./PickupScheduler";

const MapLocationPicker = dynamic(
  () => import("./MapLocationPicker").then((m) => ({ default: m.MapLocationPicker })),
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

// Native <input> style — focus:ring works correctly here (no HeroUI wrapper)
const inputCls =
  "min-h-12 w-full rounded-xl border-0 bg-kun-filter-pill-bg px-4 text-sm text-foreground outline-none ring-1 ring-black/6 transition-shadow focus:ring-2 focus:ring-kun-products-forest/40 placeholder:text-foreground/35 disabled:opacity-50";

export type StoreLocationInfo = {
  lat: number;
  lng: number;
  address: string;
};

type Props = {
  tab: CheckoutTabId;
  deliveryForm: DeliveryForm;
  onDeliveryFormChange: (patch: Partial<DeliveryForm>) => void;
  pickupForm: PickupForm;
  onPickupFormChange: (patch: Partial<PickupForm>) => void;
  savedAddresses: UserAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string | null) => void;
  tableName?: string | null;
  tableArea?: string | null;
  storeLocation?: StoreLocationInfo | null;
  profileName?: string | null;
  profilePhone?: string | null;
};

const NEW_ADDRESS_ID = "__new__";

// Shared card shell — no overflow-hidden so focus rings aren't clipped
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/6 bg-white shadow-[0_8px_32px_-16px_rgba(0,0,0,0.1)]">
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function CheckoutFulfillmentSection({
  tab,
  deliveryForm,
  onDeliveryFormChange,
  pickupForm,
  onPickupFormChange,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
  tableName,
  tableArea,
  storeLocation,
  profileName,
  profilePhone,
}: Props) {
  return (
    <div className="relative min-h-[120px]">
      <AnimatePresence mode="wait" initial={false}>
        {tab === CHECKOUT_TAB.TABLE ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: easeOutSmooth }}
          >
            <TableOrderCard tableName={tableName} tableArea={tableArea} />
          </motion.div>
        ) : null}

        {tab === CHECKOUT_TAB.DELIVERY ? (
          <motion.div
            key="delivery"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: easeOutSmooth }}
          >
            <DeliveryFulfillmentCard
              form={deliveryForm}
              onChange={onDeliveryFormChange}
              savedAddresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={onSelectAddress}
              profileName={profileName}
              profilePhone={profilePhone}
            />
          </motion.div>
        ) : null}

        {tab === CHECKOUT_TAB.PICKUP ? (
          <motion.div
            key="pickup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: easeOutSmooth }}
            className="space-y-6"
          >
            <PickupStoreCard storeLocation={storeLocation} />
            <PickupDetailsCard
              form={pickupForm}
              onChange={onPickupFormChange}
              profileName={profileName}
              profilePhone={profilePhone}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Shared contact helpers ────────────────────────────────────────────────────

type ContactMode = "account" | "custom";

function ContactModeToggle({
  mode,
  onModeChange,
}: {
  mode: ContactMode;
  onModeChange: (m: ContactMode) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex gap-1 rounded-full bg-surface-card p-1">
      <button
        type="button"
        onClick={() => onModeChange("account")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${mode === "account"
          ? "bg-white text-kun-products-forest shadow-sm ring-1 ring-black/6"
          : "text-muted hover:text-foreground"
          }`}
      >
        <User className="size-3.5" />
        {t("my_account")}
      </button>
      <button
        type="button"
        onClick={() => onModeChange("custom")}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors ${mode === "custom"
          ? "bg-white text-foreground shadow-sm ring-1 ring-black/6"
          : "text-muted hover:text-foreground"
          }`}
      >
        {t("other_recipient")}
      </button>
    </div>
  );
}

function AccountInfoCard({ name, phone }: { name: string; phone: string }) {
  const initial = name.trim().split(" ").at(-1)?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-kun-products-forest bg-kun-mint/10 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-kun-primary text-sm font-bold text-white">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-foreground/60">{phone}</p>
      </div>
      <CheckCircle2 className="size-4 shrink-0 text-kun-products-forest" />
    </div>
  );
}

// ── Delivery ──────────────────────────────────────────────────────────────────

function DeliveryFulfillmentCard({
  form,
  onChange,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
  profileName,
  profilePhone,
}: {
  form: DeliveryForm;
  onChange: (patch: Partial<DeliveryForm>) => void;
  savedAddresses: UserAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string | null) => void;
  profileName?: string | null;
  profilePhone?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [contactMode, setContactMode] = useState<ContactMode>("custom");

  const canUseAccount = !!(profileName && profilePhone);
  const showNewForm = selectedAddressId === NEW_ADDRESS_ID || savedAddresses.length === 0;

  // When profile data arrives, switch to account mode and pre-fill (once only)
  const hasInitContact = useRef(false);
  useEffect(() => {
    if (hasInitContact.current || !profileName || !profilePhone) return;
    hasInitContact.current = true;
    setContactMode("account");
    if (!form.name && !form.phone) {
      onChange({ name: profileName, phone: profilePhone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileName, profilePhone]);

  function handleContactModeChange(mode: ContactMode) {
    setContactMode(mode);
    if (mode === "account" && profileName && profilePhone) {
      onChange({ name: profileName, phone: profilePhone });
    }
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
        onChange({ lat, lng });
        const address = await reverseGeocode(lat, lng);
        setGeoLoading(false);
        if (address) onChange({ fullAddress: address });
      },
      () => {
        setGeoLoading(false);
        setGeoError(t("location_permission_denied"));
      },
      { timeout: 10_000 },
    );
  }

  return (
    <SectionCard>
      {/* Full-screen map picker — portal-like fixed overlay */}
      {showMap && (
        <MapLocationPicker
          initialLat={form.lat}
          initialLng={form.lng}
          onConfirm={(lat, lng, address) => {
            onChange({ lat, lng, fullAddress: address });
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("delivery_type")}
      </p>

      <div className="flex items-center gap-2 text-foreground">
        <MapPin className="size-5 shrink-0 text-kun-products-forest" aria-hidden />
        <h2 className="text-lg font-semibold sm:text-xl">{t("delivery_address_title")}</h2>
      </div>

      {/* Saved address list */}
      {savedAddresses.length > 0 && (
        <div className="space-y-2">
          {savedAddresses.map((addr) => {
            const isSelected = selectedAddressId === addr.id;
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => onSelectAddress(addr.id)}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${isSelected
                  ? "border-kun-products-forest bg-kun-mint/10"
                  : "border-transparent bg-kun-filter-pill-bg ring-1 ring-black/6 hover:ring-black/10"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-kun-products-forest" : "border-black/25"
                      }`}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-kun-products-forest" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {addr.fullAddress}
                    </p>
                    {addr.note && (
                      <p className="mt-0.5 text-xs text-foreground/50">{addr.note}</p>
                    )}
                    {addr.isDefault && (
                      <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        {t("default")}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-kun-products-forest" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Add new address option */}
          <button
            type="button"
            onClick={() => onSelectAddress(NEW_ADDRESS_ID)}
            className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${showNewForm
              ? "border-kun-products-forest bg-kun-mint/10"
              : "border-transparent bg-kun-filter-pill-bg ring-1 ring-black/6 hover:ring-black/10"
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${showNewForm ? "border-kun-products-forest" : "border-black/25"
                  }`}
              >
                {showNewForm && <div className="size-2 rounded-full bg-kun-products-forest" />}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                <Plus className="size-3.5" />
                {t("add_new_address_option")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push(ROUTES.ADDRESSES)}
            className="mt-1 flex items-center gap-1 text-xs text-foreground/40 transition-colors hover:text-foreground/70"
          >
            <ExternalLink className="size-3" />
            {t("manage_addresses")}
          </button>
        </div>
      )}

      {/* New address form */}
      <AnimatePresence initial={false}>
        {showNewForm && (
          <motion.div
            key="new-address-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: easeOutSmooth }}
            className="overflow-hidden"
          >
            {/*
             * px-px + pb-1: gives 1px clearance so the focus ring-2 (2px outward)
             * on native inputs is not clipped by the overflow-hidden above.
             * Without this, ring edges touching the div boundary get cut off.
             */}
            <div className="space-y-4 px-px pb-1 pt-2">
              {/* Address row */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <label className="text-xs font-medium text-foreground/70">
                    {t("full_address")}
                  </label>
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
                      {geoLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Navigation className="size-3" />
                      )}
                      {t("gps")}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder={t("address_placeholder")}
                  value={form.fullAddress}
                  onChange={(e) => onChange({ fullAddress: e.target.value })}
                  className={inputCls}
                  name="fullAddress"
                  autoComplete="street-address"
                />
                {geoError && (
                  <p className="mt-1.5 text-xs text-red-500">{geoError}</p>
                )}
                {form.lat != null && form.lng != null && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs tabular-nums text-kun-products-forest">
                    <Navigation className="size-3 shrink-0" />
                    {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </p>
                )}
              </div>

              {/* Recipient info — toggle between account and custom */}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-foreground/70">
                  {t("recipient_label")} *
                </label>
                {canUseAccount && (
                  <ContactModeToggle mode={contactMode} onModeChange={handleContactModeChange} />
                )}
                {contactMode === "account" && form.name && form.phone ? (
                  <AccountInfoCard name={form.name} phone={form.phone} />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                        {t("recipient_name_label")} *
                      </label>
                      <input
                        type="text"
                        placeholder={t("full_name")}
                        value={form.name}
                        onChange={(e) => onChange({ name: e.target.value })}
                        className={inputCls}
                        name="recipientName"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                        {t("phone_number")} *
                      </label>
                      <input
                        type="tel"
                        placeholder="+84 90 000 0000"
                        value={form.phone}
                        onChange={(e) => onChange({ phone: e.target.value })}
                        className={inputCls}
                        name="phone"
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                  {t("delivery_note_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("delivery_note_placeholder")}
                  value={form.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  className={inputCls}
                  name="deliveryNote"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionCard>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function TableOrderCard({
  tableName,
  tableArea,
}: {
  tableName?: string | null;
  tableArea?: string | null;
}) {
  const t = useTranslations();
  const area = (tableArea ?? "").trim() || t("default_area");
  return (
    <SectionCard>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("delivery_type")}
      </p>
      <div className="flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-kun-filter-pill-bg text-kun-products-forest ring-1 ring-black/6">
          <Utensils className="size-6" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {tableName ?? t("type_table")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/65">
            {t("table_area_service", { area })}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Pickup store info ─────────────────────────────────────────────────────────

function PickupStoreCard({ storeLocation }: { storeLocation?: StoreLocationInfo | null }) {
  const t = useTranslations();
  const hasCoords = storeLocation && storeLocation.lat !== 0 && storeLocation.lng !== 0;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${storeLocation.lat},${storeLocation.lng}`
    : null;
  const address = storeLocation?.address?.trim() || null;

  return (
    <SectionCard>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("pickup_point")}
      </p>
      <div className="flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-kun-filter-pill-bg text-kun-products-forest ring-1 ring-black/6">
          <MapPin className="size-6" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">UjCha Matcha &amp; More</h2>

          {address ? (
            <p className="mt-1 text-sm leading-relaxed text-foreground/65">{address}</p>
          ) : (
            <p className="mt-1 text-sm italic leading-relaxed text-foreground/40">
              {t("address_not_set")}
            </p>
          )}

          {/* {hasCoords && (
            <p className="mt-1 text-xs tabular-nums text-foreground/40">
              {storeLocation.lat.toFixed(6)}, {storeLocation.lng.toFixed(6)}
            </p>
          )} */}

          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-kun-filter-pill-bg px-3 py-1.5 text-xs font-medium text-kun-products-forest ring-1 ring-black/6 transition-colors hover:ring-black/10"
            >
              <MapPin className="size-3.5" aria-hidden />
              {t("view_on_map")}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

// ── Pickup details (time + contact) ──────────────────────────────────────────

function PickupDetailsCard({
  form,
  onChange,
  profileName,
  profilePhone,
}: {
  form: PickupForm;
  onChange: (patch: Partial<PickupForm>) => void;
  profileName?: string | null;
  profilePhone?: string | null;
}) {
  const t = useTranslations();
  const [contactMode, setContactMode] = useState<ContactMode>("custom");
  const canUseAccount = !!(profileName && profilePhone);

  const hasInitContact = useRef(false);
  useEffect(() => {
    if (hasInitContact.current || !profileName || !profilePhone) return;
    hasInitContact.current = true;
    setContactMode("account");
    if (!form.name && !form.phone) {
      onChange({ name: profileName, phone: profilePhone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileName, profilePhone]);

  function handleContactModeChange(mode: ContactMode) {
    setContactMode(mode);
    if (mode === "account" && profileName && profilePhone) {
      onChange({ name: profileName, phone: profilePhone });
    }
  }

  return (
    <SectionCard>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("pickup_details")}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Pickup time */}
        <div>
          <label className="mb-3 block text-xs font-medium text-foreground/70">
            {t("pickup_time")}
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onChange({ mode: "asap", scheduledTime: "" })}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${form.mode === "asap"
                ? "border-kun-products-forest bg-kun-mint/15 text-kun-products-forest"
                : "border-transparent bg-kun-filter-pill-bg text-foreground/80 ring-1 ring-black/6"
                }`}
            >
              {t("pickup_asap")}
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: "scheduled" })}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${form.mode === "scheduled"
                ? "border-kun-products-forest bg-kun-mint/15 text-kun-products-forest"
                : "border-transparent bg-kun-filter-pill-bg text-foreground/80 ring-1 ring-black/6"
                }`}
            >
              {t("pickup_schedule")}
            </button>
          </div>

          {form.mode === "scheduled" && (
            <PickupScheduler
              value={form.scheduledTime}
              onChange={(iso) => onChange({ scheduledTime: iso })}
            />
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-foreground/70">
            {t("contact_info")} *
          </label>
          {canUseAccount && (
            <ContactModeToggle mode={contactMode} onModeChange={handleContactModeChange} />
          )}
          {contactMode === "account" && form.name && form.phone ? (
            <AccountInfoCard name={form.name} phone={form.phone} />
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                  {t("contact_name_label")} *
                </label>
                <input
                  type="text"
                  placeholder={t("full_name")}
                  value={form.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className={inputCls}
                  name="contactName"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                  {t("phone_number")} *
                </label>
                <input
                  type="tel"
                  placeholder="+84 90 000 0000"
                  value={form.phone}
                  onChange={(e) => onChange({ phone: e.target.value })}
                  className={inputCls}
                  name="contactPhone"
                  autoComplete="tel"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

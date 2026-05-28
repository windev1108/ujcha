export type DeliveryForm = {
  fullAddress: string;
  name: string;
  phone: string;
  note: string;
  lat: number | null;
  lng: number | null;
};

export type PickupForm = {
  mode: "asap" | "scheduled";
  scheduledTime: string;
  name: string;
  phone: string;
};

export type PaymentMethod = "cash" | "bank_transfer";

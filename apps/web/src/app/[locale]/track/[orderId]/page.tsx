import { redirect } from "next/navigation";

// Tracking has been moved inline into the order detail page.
export default async function TrackOrderPage() {
  redirect("/orders");
}

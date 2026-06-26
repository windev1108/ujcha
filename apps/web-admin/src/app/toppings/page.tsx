import { redirect } from "next/navigation";

export default function ToppingsPage() {
  redirect("/products?tab=categories");
}

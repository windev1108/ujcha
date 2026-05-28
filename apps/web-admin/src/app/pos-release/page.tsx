import type { Metadata } from "next";

import { PosReleaseClient } from "./components/PosReleaseClient";

export const metadata: Metadata = {
  title: "Cập nhật UjCha POS — UjCha Admin",
};

export default function PosReleasePage() {
  return <PosReleaseClient />;
}

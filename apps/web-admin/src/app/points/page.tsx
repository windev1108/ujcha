import type { Metadata } from "next";

import { PointsPageClient } from "./components/PointsPageClient";

export const metadata: Metadata = {
  title: "Điểm UjCha — UjCha Admin",
  description: "Cấu hình và theo dõi điểm thưởng UjCha",
};

export default function PointsPage() {
  return <PointsPageClient />;
}

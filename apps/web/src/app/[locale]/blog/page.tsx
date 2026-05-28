import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BlogPageShell } from "./components/BlogPageShell";

export const metadata: Metadata = {
  title: "Blog & Tin tức",
  description: "Khám phá công thức matcha, câu chuyện thương hiệu và tin tức mới nhất từ UjCha.",
};

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <BlogPageShell />
    </Suspense>
  );
}

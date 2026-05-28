import Image from "next/image";
import { cn } from "@/lib/utils";

type KunLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { w: 80, h: 56 },
  md: { w: 180, h: 60 },
  lg: { w: 240, h: 144 },
};

export function Logo({ className, size = "md" }: KunLogoProps) {
  const { w, h } = sizes[size];
  return (
    <Image
      src="/logo.png"
      alt="UjCha"
      width={w}
      height={h}
      className={cn("object-contain object-left", className)}
      priority
    />
  );
}

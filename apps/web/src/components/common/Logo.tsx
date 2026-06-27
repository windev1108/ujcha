import Image from "next/image";
import { cn } from "@/lib/utils";

type KunLogoProps = {
  className?: string;
  horizontal?: boolean;
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { w: 140, h: 100 },
  md: { w: 200, h: 120 },
  lg: { w: 240, h: 144 },
};

export function Logo({ className, horizontal = true, theme = "dark", size = "md" }: KunLogoProps) {
  const { w, h } = sizes[size];
  return (
    <Image
      src={horizontal ? (theme === "light" ? "/logo-light.png" : "/logo.png") : "/vertical-logo.png"}
      alt="UjCha"
      width={w}
      height={h}
      className={cn("object-contain object-left", className)}
      priority
    />
  );
}

import { cn } from "@/lib/utils";
import Image from "next/image";


type KunLogoProps = {
  width?: number;
  height?: number;
  src?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function KunLogo({
  width = 48,
  height = 16,
  src = "/logo.png",
  className,
  size = "md",
}: KunLogoProps) {
  const sizeClass = {
    sm: "w-20 h-14",
    md: "w-40 h-28",
    lg: "w-60 h-36",
  }[size];
  return <Image unoptimized src={src} alt="UjCha" width={width} height={height} className={cn("object-contain object-center", sizeClass, className)} aria-hidden />;
}
import { cn } from "../lib/utils";
import logoImage from "../../logos.png";

type BrandLogoSize = "sm" | "md" | "lg";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
  size?: BrandLogoSize;
}

const iconSizeClasses: Record<BrandLogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-11 w-11",
};

const titleSizeClasses: Record<BrandLogoSize, string> = {
  sm: "text-lg",
  md: "text-[22px]",
  lg: "text-[24px]",
};

const subtitleSizeClasses: Record<BrandLogoSize, string> = {
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[10px]",
};

export default function BrandLogo({ className, showText = true, size = "md" }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center", showText ? "gap-3" : "gap-0", className)}>
      <img
        src={logoImage}
        alt=""
        aria-hidden="true"
        className={cn("block shrink-0 object-contain", iconSizeClasses[size])}
        decoding="async"
      />

      {showText ? (
        <span className="flex flex-col justify-center leading-none">
          <span className={cn("font-bold tracking-tight text-foreground", titleSizeClasses[size])}>Thumora AI</span>
          <span className={cn("font-bold uppercase tracking-[0.24em] text-muted-foreground", subtitleSizeClasses[size])}>
            AI Thumbnail Editor
          </span>
        </span>
      ) : null}
    </div>
  );
}

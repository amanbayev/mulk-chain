import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-[15px] font-semibold tracking-[0.18em]">MÜLK</span>
      <span className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground">CHAIN</span>
    </div>
  );
}

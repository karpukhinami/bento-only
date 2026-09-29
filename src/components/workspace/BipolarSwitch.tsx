import { cn } from "@/lib/utils";
import type { BipolarFeedbackValue } from "@/lib/image-feedback-types";

interface Props {
  value: BipolarFeedbackValue;
  onChange: (value: "left" | "right") => void;
  ariaLabel: string;
}

export function BipolarSwitch({ value, onChange, ariaLabel }: Props) {
  const thumbPosition =
    value === "left"
      ? "left-0.5"
      : value === "right"
        ? "left-[calc(100%-1.25rem-0.125rem)]"
        : "left-1/2 -translate-x-1/2";

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={value === "right" ? true : value === "left" ? false : undefined}
      className={cn(
        "relative h-6 w-12 shrink-0 rounded-full border transition-colors",
        value === "neutral" && "border-border bg-muted/80",
        value === "left" && "border-emerald-500/50 bg-emerald-500/15",
        value === "right" && "border-red-500/50 bg-red-500/15",
      )}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        onChange(x >= rect.width / 2 ? "right" : "left");
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange("left");
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange("right");
        }
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5 rounded-full shadow-sm transition-all duration-200",
          value === "neutral" && "bg-muted-foreground/35",
          value === "left" && "bg-emerald-500",
          value === "right" && "bg-red-500",
          thumbPosition,
        )}
      />
    </button>
  );
}

export function poleLabelClass(side: "left" | "right", active: boolean) {
  return cn(
    "rounded-md px-1.5 py-1 text-[11px] leading-tight transition-colors cursor-pointer select-none text-center",
    !active && "text-muted-foreground hover:text-foreground",
    active && side === "left" && "font-medium text-emerald-800 bg-emerald-500/20",
    active && side === "right" && "font-medium text-red-800 bg-red-500/20",
  );
}

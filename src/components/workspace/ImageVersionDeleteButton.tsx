import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
}

export function ImageVersionDeleteButton({ onClick, className, title = "Удалить" }: Props) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full",
        "bg-muted/95 text-muted-foreground shadow-sm",
        "hover:bg-muted hover:text-foreground",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="h-3 w-3" />
    </button>
  );
}

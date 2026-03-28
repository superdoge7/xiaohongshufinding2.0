import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "ok" | "warning" | "error" | "loading";
  label: string;
}

const styles = {
  ok: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  loading: "bg-blue-100 text-blue-700",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        styles[status]
      )}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full", {
          "bg-green-500": status === "ok",
          "bg-amber-500": status === "warning",
          "bg-red-500": status === "error",
          "bg-blue-500 animate-pulse": status === "loading",
        })}
      />
      {label}
    </span>
  );
}

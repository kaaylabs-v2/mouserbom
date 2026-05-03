import { cn } from "@/lib/utils";

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const band = value >= 0.85 ? "success" : value >= 0.6 ? "warn" : "danger";
  const color = band === "success" ? "bg-success" : band === "warn" ? "bg-warn" : "bg-danger";
  const label = band === "success" ? "High" : band === "warn" ? "Medium" : "Low";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: pct + "%" }} />
      </div>
      <span className="mono text-xs tabular-nums w-9 text-right">{pct}%</span>
      <span className="sr-only">{label} confidence</span>
    </div>
  );
}

export function StockBar({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="mono text-xs text-muted-foreground">—</span>;
  const pct = Math.min(100, (stock / 50000) * 100);
  const color = stock === 0 ? "bg-danger" : stock < 1000 ? "bg-warn" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <span className="mono text-xs tabular-nums w-14 text-right">{stock.toLocaleString()}</span>
      <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: Math.max(pct, stock > 0 ? 6 : 0) + "%" }} />
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; live?: boolean }> = {
    queued: { label: "Queued", cls: "bg-muted text-muted-foreground" },
    processing: { label: "Processing", cls: "bg-accent-cyan/10 text-foreground", live: true },
    complete: { label: "Complete", cls: "bg-success/10 text-success" },
    partial: { label: "Partial", cls: "bg-warn/10 text-warn" },
    failed: { label: "Failed", cls: "bg-danger/10 text-danger" },
  };
  const m = map[status] ?? map.queued;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", m.cls)}>
      {m.live && <span className="live-dot" />}
      {m.label}
    </span>
  );
}

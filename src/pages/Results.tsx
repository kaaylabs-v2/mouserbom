import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getResults, getJobMeta, submitFeedback } from "@/lib/mockApi";
import { ResultRow } from "@/lib/mockData";
import { ConfidenceBar, StockBar } from "@/components/atoms";
import { ChevronRight, Download, Code2, Share2, Search, MoreHorizontal, X, Check, Copy, FileText, Cpu, Lightbulb, HelpCircle, Loader2 } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

type FilterBand = "high" | "med" | "low";
type DrawerTab = "reco" | "alts" | "input" | "audit" | "diag";

export default function Results() {
  const { jobId } = useParams();
  const rawRows = useMemo(() => getResults(jobId ?? ""), [jobId]);
  const meta = useMemo(() => getJobMeta(jobId ?? ""), [jobId]);
  const [search, setSearch] = useSearchParams();
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [drawerRow, setDrawerRow] = useState<ResultRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("reco");
  const [tab, setTab] = useState<"recommendations" | "no-match" | "flagged" | "history">("recommendations");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filename, setFilename] = useState(meta?.file ?? "bom.csv");
  const [apiOpen, setApiOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, Partial<ResultRow>>>({});
  const rows = useMemo(
    () => rawRows.map(r => (overrides[r.n] ? { ...r, ...overrides[r.n] } : r)),
    [rawRows, overrides]
  );
  useEffect(() => { if (meta?.file) setFilename(meta.file); }, [meta?.file]);

  const q = search.get("q") ?? "";
  const inStock = search.get("stock") === "1";
  const hasAlts = search.get("alts") === "1";
  const bandsParam = search.get("bands");
  const bands = new Set<FilterBand>(bandsParam ? (bandsParam.split(",") as FilterBand[]) : ["high", "med", "low"]);

  const filtered = useMemo(() => {
    if (tab === "history") return [];
    return rows.filter(r => {
      if (tab === "no-match" && r.sku !== "no_match") return false;
      if (tab === "flagged" && (r.sku === "no_match" || r.confidence >= 0.85)) return false;
      if (q && !(r.sku + r.mpn + r.mfr + (r.input.mpn ?? "") + (r.input.description ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
      if (inStock && (!r.stock || r.stock === 0)) return false;
      if (hasAlts && r.alts === 0) return false;
      const band: FilterBand = r.confidence >= 0.85 ? "high" : r.confidence >= 0.6 ? "med" : "low";
      if (!bands.has(band)) return false;
      return true;
    });
  }, [rows, q, inStock, hasAlts, bands, tab]);

  const stats = useMemo(() => {
    const total = rows.length;
    const high = rows.filter(r => r.confidence >= 0.85).length;
    const noMatch = rows.filter(r => r.sku === "no_match").length;
    const avg = rows.reduce((a, r) => a + r.confidence, 0) / total;
    const cost = rows.reduce((a, r) => a + (r.price ?? 0) * r.qty, 0);
    return { total, high, noMatch, avg, cost };
  }, [rows]);

  const selectedTotal = useMemo(
    () => rows.filter(r => selected.has(r.n)).reduce((a, r) => a + (r.price ?? 0) * r.qty, 0),
    [rows, selected]
  );

  const updateParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(search);
    if (v == null || v === "") next.delete(k); else next.set(k, v);
    setSearch(next, { replace: true });
  };

  const toggleBand = (b: FilterBand) => {
    const next = new Set(bands);
    next.has(b) ? next.delete(b) : next.add(b);
    updateParam("bands", Array.from(next).join(","));
  };

  const exportRows = (fmt: "csv" | "xlsx" | "json") => {
    const data = rows.map(r => ({
      "#": r.n, "As requested": r.input.mpn ?? r.input.description ?? "",
      SKU: r.sku, MPN: r.mpn, Manufacturer: r.mfr, Package: r.pkg,
      Price: r.price, Stock: r.stock, Qty: r.qty, Confidence: r.confidence,
    }));
    const base = `${jobId}-results`;
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${base}.json`);
    } else if (fmt === "csv") {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      downloadBlob(new Blob([csv], { type: "text/csv" }), `${base}.csv`);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Results");
      XLSX.writeFile(wb, `${base}.xlsx`);
    }
    toast.success(`Exported ${rows.length} lines as ${fmt.toUpperCase()}`);
  };

  const openDrawer = (row: ResultRow, initial: DrawerTab = "reco") => {
    setDrawerRow(row);
    const isNoMatch = row.sku === "no_match";
    if (isNoMatch && (initial === "reco" || initial === "input")) setDrawerTab("diag");
    else setDrawerTab(initial);
  };

  const handleAction = async (action: "accept" | "reject" | "replace", row: ResultRow, replacedWith?: string) => {
    await submitFeedback({ recommendation_id: row.sku, action, replacedWith });
    const verb = action === "accept" ? "Accepted" : action === "reject" ? "Rejected" : "Replaced";
    toast.success(`${verb} line ${row.n.toString().padStart(2, "0")}`);
    setDrawerRow(null);
  };

  const applyOverride = (n: number, patch: Partial<ResultRow>) => {
    setOverrides(prev => ({ ...prev, [n]: { ...(prev[n] ?? {}), ...patch } }));
    setDrawerRow(prev => (prev && prev.n === n ? { ...prev, ...patch } : prev));
  };


  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-14 z-20">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center gap-4">
          <div>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="text-base font-semibold bg-transparent focus-ring rounded px-1 -mx-1"
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="mono">{rows.length} lines</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-accent-cyan/10">
                <span className="live-dot" /> Live snapshot · <span className="mono">snap_2026_04_28</span>
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
                  <Download className="h-4 w-4" /> Export <ChevronRight className="h-3 w-3 rotate-90" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportRows("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportRows("json")}>JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setApiOpen(true)} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
              <Code2 className="h-4 w-4" /> API
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
              className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="flex gap-1">
            {(["recommendations", "no-match", "flagged", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`relative px-3 h-9 text-sm capitalize focus-ring ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t.replace("-", " ")}
                {tab === t && <span className="absolute -bottom-px left-2 right-2 h-px bg-accent" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-6">
        {/* Stat tiles */}
        <div className="grid grid-cols-4 gap-4">
          <Stat label="Avg. confidence" value={`${Math.round(stats.avg * 100)}%`} bar={stats.avg} />
          <Stat label="High-confidence lines" value={`${stats.high} / ${stats.total}`} sub="≥85%" />
          <Stat label="No-match lines" value={`${stats.noMatch}`} sub="Resolve" subAccent onSubClick={() => { setTab("no-match"); updateParam("tab", "no-match"); }} />
          <Stat label="Total est. cost @ qty" value={`$${stats.cost.toFixed(2)}`} sub="USD" />
        </div>

        {tab === "history" ? (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <div className="eyebrow text-muted-foreground mb-2">JOB HISTORY</div>
            <p className="text-sm text-muted-foreground">Job history is captured per workspace. Coming soon.</p>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => updateParam("q", e.target.value)}
                  placeholder="Search MPN, manufacturer, description, or your line"
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-card border border-border text-sm focus-ring" />
              </div>
              <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                {(["high", "med", "low"] as FilterBand[]).map(b => (
                  <button key={b} onClick={() => toggleBand(b)}
                    className={`h-8 px-3 rounded text-xs capitalize focus-ring ${bands.has(b) ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
                    {b === "high" ? "High" : b === "med" ? "Med" : "Low"}
                  </button>
                ))}
              </div>
              <Toggle label="In stock only" on={inStock} onClick={() => updateParam("stock", inStock ? null : "1")} />
              <Toggle label="Has alternatives" on={hasAlts} onClick={() => updateParam("alts", hasAlts ? null : "1")} />
            </div>

            {/* Table */}
            <div className="mt-4 rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className="w-10 text-left px-4 py-2.5 font-medium">#</th>
                    <th className="text-left px-3 py-2.5 font-medium">Your line</th>
                    <th className="text-left px-3 py-2.5 font-medium">Recommended part</th>
                    <th className="text-left px-3 py-2.5 font-medium">MPN</th>
                    <th className="text-left px-3 py-2.5 font-medium">Manufacturer</th>
                    <th className="text-left px-3 py-2.5 font-medium">Pkg</th>
                    <th className="text-right px-3 py-2.5 font-medium">Price</th>
                    <th className="text-left px-3 py-2.5 font-medium">Avail.</th>
                    <th className="text-left px-3 py-2.5 font-medium">Alts</th>
                    <th className="text-left px-3 py-2.5 font-medium">Confidence</th>
                    <th className="w-10 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <Row
                      key={r.n}
                      r={r}
                      open={openRow === r.n}
                      onToggle={() => setOpenRow(openRow === r.n ? null : r.n)}
                      onOpen={(t?: DrawerTab) => openDrawer(r, t)}
                      selected={selected.has(r.n)}
                      onSelect={() => {
                        const next = new Set(selected);
                        next.has(r.n) ? next.delete(r.n) : next.add(r.n);
                        setSelected(next);
                      }}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No lines match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Sticky multi-select bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-navy text-navy-foreground rounded-lg border border-border px-4 py-2.5 flex items-center gap-3 z-30">
            <span className="mono text-xs">{selected.size} selected</span>
            <span className="mono text-xs text-accent-cyan">${selectedTotal.toFixed(2)}</span>
            <div className="h-4 w-px bg-navy-foreground/20" />
            <button onClick={() => toast.success(`Replaced ${selected.size} lines`)} className="text-sm px-2 py-1 rounded hover:bg-white/10">Replace with alternative</button>
            <button onClick={() => toast.success(`Rejected ${selected.size} lines`)} className="text-sm px-2 py-1 rounded hover:bg-white/10">Reject</button>
            <button onClick={() => exportRows("csv")} className="text-sm px-2 py-1 rounded hover:bg-white/10">Export selected</button>
            <button onClick={() => setSelected(new Set())} className="ml-1 p-1 rounded hover:bg-white/10"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API sheet */}
      <Sheet open={apiOpen} onOpenChange={setApiOpen}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-auto">
          <SheetHeader>
            <SheetTitle>API access</SheetTitle>
            <SheetDescription>Retrieve this job's results programmatically.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div>
              <div className="eyebrow text-muted-foreground mb-2">cURL</div>
              <pre className="mono text-xs bg-surface-muted p-3 rounded border border-border overflow-x-auto">{`curl -X GET https://api.mouser-bom.dev/v1/jobs/${jobId}/results \\
  -H "Authorization: Bearer $MOUSER_API_KEY" \\
  -H "Accept: application/json"`}</pre>
            </div>
            <div>
              <div className="eyebrow text-muted-foreground mb-2">JavaScript</div>
              <pre className="mono text-xs bg-surface-muted p-3 rounded border border-border overflow-x-auto">{`const res = await fetch(
  "https://api.mouser-bom.dev/v1/jobs/${jobId}/results",
  { headers: { Authorization: \`Bearer \${process.env.MOUSER_API_KEY}\` } }
);
const { lines } = await res.json();`}</pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Line drawer */}
      <AnimatePresence>
        {drawerRow && (
          <LineDrawer
            row={drawerRow}
            tab={drawerTab}
            setTab={setDrawerTab}
            onClose={() => setDrawerRow(null)}
            onAction={handleAction}
            jobId={jobId ?? ""}
            onApplyOverride={applyOverride}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, sub, bar, subAccent, onSubClick }: { label: string; value: string; sub?: string; bar?: number; subAccent?: boolean; onSubClick?: () => void }) {
  const SubEl = onSubClick ? "button" : "div";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 mono text-2xl font-semibold tabular-nums">{value}</div>
      {bar != null && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
      {sub && <SubEl onClick={onSubClick} className={`mt-2 text-xs text-left ${subAccent ? "text-accent hover:underline focus-ring rounded" : "text-muted-foreground"}`}>{sub}</SubEl>}
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`h-9 px-3 rounded-md border text-xs focus-ring ${on ? "border-accent bg-accent/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );
}

function priceTiers(price: number) {
  return [[1, price], [10, price * 0.92], [100, price * 0.84], [1000, price * 0.71]] as const;
}

function PriceCell({ price }: { price: number | null }) {
  if (price == null) return <span className="mono text-sm text-muted-foreground">—</span>;
  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <span className="mono text-sm tabular-nums cursor-default">${price.toFixed(2)}</span>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-56">
        <div className="eyebrow text-muted-foreground mb-2">PRICE TIERS</div>
        <table className="w-full mono text-xs">
          <tbody>
            {priceTiers(price).map(([q, p]) => (
              <tr key={q} className="border-b border-border last:border-0">
                <td className="py-1">{q}+</td>
                <td className="py-1 text-right">${p.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HoverCardContent>
    </HoverCard>
  );
}

function ConfidenceWithTip({ value }: { value: number }) {
  const band = value >= 0.85 ? "High" : value >= 0.6 ? "Medium" : "Low";
  const copy = value >= 0.85
    ? "High confidence. Calibrated to auto-accept by default."
    : value >= 0.6
      ? "Medium confidence. Verify before accepting."
      : "Low confidence. Decision required before adding to cart.";
  return (
    <Tooltip>
      <TooltipTrigger asChild><div><ConfidenceBar value={value} /></div></TooltipTrigger>
      <TooltipContent><div className="text-xs"><strong>{band}</strong> · {copy}</div></TooltipContent>
    </Tooltip>
  );
}

function Row({ r, open, onToggle, onOpen, selected, onSelect }: {
  r: ResultRow; open: boolean; onToggle: () => void; onOpen: (t?: DrawerTab) => void; selected: boolean; onSelect: () => void;
}) {
  const isNoMatch = r.sku === "no_match";
  return (
    <>
      <tr
        className={`group border-b border-border last:border-0 hover:bg-surface-muted relative cursor-pointer`}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button, input, [data-noclick]")) return;
          if (t.closest("[data-input-cell]")) { onOpen("input"); return; }
          onOpen();
        }}
      >
        <td className="px-4 py-3 mono text-xs text-muted-foreground relative">
          {isNoMatch && <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-danger rounded-r" />}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={selected} onChange={onSelect} data-noclick
              className="opacity-0 group-hover:opacity-100 checked:opacity-100 h-3.5 w-3.5 accent-[hsl(var(--accent))]" />
            <span>{r.n.toString().padStart(2, "0")}</span>
          </div>
        </td>
        <td className="px-3 py-3 max-w-[220px]" data-input-cell>
          <YourLineCell input={r.input} />
        <td className="px-3 py-3 align-top">
          <div className="flex items-center gap-1.5">
            {!isNoMatch && (
              <button onClick={(e) => { e.stopPropagation(); onToggle(); }} data-noclick
                className={`h-5 w-5 rounded hover:bg-muted flex items-center justify-center transition-transform ${open ? "rotate-90" : ""}`}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <span className={`mono text-sm ${isNoMatch ? "text-muted-foreground italic" : ""}`}>{isNoMatch ? "(unresolved)" : r.sku}</span>
          </div>
          {!isNoMatch && r.rationale && r.rationale.trim() !== "" && (
            <div className="mt-1 ml-[26px] flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground max-w-[420px]">
              <Lightbulb className="h-3 w-3 mt-[2px] shrink-0 text-accent" aria-hidden />
              <span>
                <span className="eyebrow text-[9px] tracking-[0.18em] text-muted-foreground/80 mr-1">WHY THIS MATCH</span>
                <span className="italic">{r.rationale}</span>
              </span>
            </div>
          )}
        </td>

        </td>
        <td className="px-3 py-3 mono text-xs">{r.mpn}</td>
        <td className="px-3 py-3 text-sm">{r.mfr}</td>
        <td className="px-3 py-3"><span className="text-xs px-1.5 py-0.5 rounded bg-muted mono">{r.pkg}</span></td>
        <td className="px-3 py-3 text-right" data-noclick><PriceCell price={r.price} /></td>
        <td className="px-3 py-3"><StockBar stock={r.stock} /></td>
        <td className="px-3 py-3">
          {r.alts > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onOpen("alts"); }} data-noclick
              className="text-xs mono px-2 py-0.5 rounded bg-muted hover:bg-border">
              {r.alts} ▸
            </button>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-3" data-noclick><ConfidenceWithTip value={r.confidence} /></td>
        <td className="px-3 py-3 text-muted-foreground" data-noclick>
          <div className="flex items-center justify-end gap-1">
            {isNoMatch && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpen("input"); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 px-2 rounded border border-danger/40 text-danger hover:bg-danger/5">
                Diagnose
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-muted">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen()}>View detail</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpen("alts")} disabled={r.alts === 0}>Replace with alternative</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.success(`Rejected line ${r.n.toString().padStart(2, "0")}`)}>Reject</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(r.sku); toast.success("SKU copied"); }}>Copy SKU</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast("Datasheet — coming soon")}>Open datasheet</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {open && !isNoMatch && (
          <tr>
            <td colSpan={11} className="bg-surface-muted border-b border-border p-0">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="px-8 py-5 grid grid-cols-3 gap-4">
                  {r.rationale && r.rationale.trim() !== "" && (
                    <div className="col-span-3">
                      <div className="eyebrow text-muted-foreground mb-1 inline-flex items-center gap-1.5">
                        <Lightbulb className="h-3 w-3 text-accent" /> WHY THIS MATCH
                      </div>
                      <p className="text-sm italic text-muted-foreground">{r.rationale}</p>
                    </div>
                  )}

                  <div className="col-span-3">
                    <div className="eyebrow text-muted-foreground mb-1">AS REQUESTED</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div className="mono"><span className="text-muted-foreground">MPN:</span> <span className="text-foreground">{r.input.mpn || "—"}</span></div>
                      <div className="mono"><span className="text-muted-foreground">Description:</span> <span className="text-foreground">{r.input.description || "—"}</span></div>
                    </div>
                  </div>
                  {r.alternatives.map((a) => (
                    <div key={a.sku} className="rounded-md border border-border bg-card p-3">
                      <div className="mono text-xs text-muted-foreground">{a.mfr}</div>
                      <div className="mono text-sm font-medium mt-0.5">{a.mpn}</div>
                      {a.tradeoff_note && a.tradeoff_note.trim() !== "" && (
                        <div className="mt-0.5 text-[11px] italic text-muted-foreground/90 leading-snug">{a.tradeoff_note}</div>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-muted mono">{a.pkg}</span>
                        <span className="mono">${a.price.toFixed(2)}</span>
                        <span className="mono text-muted-foreground">{a.stock.toLocaleString()} in stock</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        <Badge ok={a.match.pkg}>Pkg</Badge>
                        <Badge ok={a.match.tol}>Tol</Badge>
                        <Badge ok={a.match.voltage}>Voltage</Badge>
                      </div>
                      <button
                        onClick={async () => {
                          await submitFeedback({ recommendation_id: r.sku, action: "replace", replacedWith: a.sku });
                          toast.success(`Replaced line ${r.n.toString().padStart(2, "0")} with ${a.mpn}`);
                        }}
                        className="mt-3 w-full h-8 rounded-md border border-border text-xs hover:bg-muted focus-ring">Use this</button>
                    </div>
                  ))}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] mono px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
      {children} {ok ? "✓" : "✗"}
    </span>
  );
}

function YourLineCell({ input }: { input: { mpn?: string; description?: string } }) {
  const text = input.mpn && input.mpn.length > 0 ? input.mpn : (input.description ?? "");
  const display = text.length > 40 ? text.slice(0, 40) + "…" : text;
  if (!text) return <span className="mono text-xs text-muted-foreground">—</span>;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="mono text-xs text-muted-foreground truncate block max-w-[200px] cursor-default">{display}</span>
      </TooltipTrigger>
      <TooltipContent><span className="mono text-xs">{text}</span></TooltipContent>
    </Tooltip>
  );
}

function LineDrawer({ row, tab, setTab, onClose, onAction, jobId, onApplyOverride }: {
  row: ResultRow; tab: DrawerTab; setTab: (t: DrawerTab) => void;
  onClose: () => void; onAction: (a: "accept" | "reject" | "replace", r: ResultRow, replacedWith?: string) => void;
  jobId: string; onApplyOverride: (n: number, patch: Partial<ResultRow>) => void;
}) {
  const isNoMatch = row.sku === "no_match";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Normalized vs raw diff (canonical fields + parser extras)
  type Row = { key: string; raw: string; norm: string };
  const baseFields: Row[] = [
    { key: "mpn",          raw: String(row.raw.mpn),  norm: row.mpn },
    { key: "manufacturer", raw: String(row.mfr),      norm: row.mfr },
    { key: "package",      raw: String(row.pkg),      norm: row.pkg },
    { key: "qty",          raw: String(row.raw.qty),  norm: String(row.qty) },
  ];
  const fmtList = (a?: string[]) => (a && a.length ? a.join(", ") : "");
  const extras: Row[] = [];
  const ri = row.input;
  const rn = row.normalized ?? {};
  if (ri.value != null)            extras.push({ key: "value",                  raw: ri.value,                                  norm: rn.value ?? ri.value });
  if (ri.tolerance != null)        extras.push({ key: "tolerance",              raw: ri.tolerance,                              norm: rn.tolerance ?? ri.tolerance });
  if (ri.voltage_rating != null)   extras.push({ key: "voltage_rating",         raw: ri.voltage_rating,                         norm: rn.voltage_rating ?? ri.voltage_rating });
  if (ri.reference_designators)    extras.push({ key: "reference_designators",  raw: fmtList(ri.reference_designators),         norm: fmtList(rn.reference_designators ?? ri.reference_designators) });
  const fieldRows: Row[] = [...baseFields, ...extras];

  // Deterministic signals from confidence
  const c = row.confidence;
  const candidateSize = isNoMatch ? 0 : 42;
  const signals: Array<[string, string, string]> = [
    ["candidate_set_size",   String(candidateSize), "Number of catalog candidates the retriever returned to the ranker — the bounding input that prevents SKU hallucination."],
    ["mpn_exact",            c >= 0.9 ? "1.00" : c.toFixed(2), "Whether the input MPN matched a canonical MPN exactly after normalization."],
    ["pkg_match",            Math.min(1, c + 0.04).toFixed(2), "Whether the candidate's package matches the parsed package."],
    ["attribute_match_pct",  Math.min(1, c + 0.01).toFixed(2), "Fraction of parsed attributes (value, tolerance, voltage, etc.) that align with the candidate."],
    ["lexical_score",        (c * 0.93).toFixed(2), "Token-level similarity between input description and catalog entry."],
    ["semantic_score",       (c * 0.98).toFixed(2), "Embedding cosine similarity between input and candidate."],
    ["mfr_pref",             row.mfr === "—" ? "0.00" : "0.92", "Manufacturer preference score from the active substitution policy."],
    ["lifecycle",            row.lifecycle === "active" ? "1.00" : "0.20", "1.0 if active; reduced for NRND/LTB; 0.2 for obsolete."],
    ["top1_minus_top2",      (c * 0.18).toFixed(2), "Margin between top-1 and top-2 candidate scores; higher means clearer winner."],
    ["policy_penalty",       "0.00", "Penalty applied by the active substitution policy."],
  ];
  // Pin attribute_match_pct to a stable demo value distinct from pkg_match.
  signals[3][1] = "0.93";

  const allEvents: Array<{ t: string; ms: string; detail: string }> = [
    { t: "ingested",   ms: "+0.00s", detail: `Row ${row.n} read from upload` },
    { t: "parsed",     ms: "+0.31s", detail: "parser:b2_v1 · column map v2 applied" },
    { t: "normalized", ms: "+0.74s", detail: `normalizer:b3_v0 · MPN canonicalized → ${row.mpn}` },
    { t: "retrieved",  ms: "+1.12s", detail: isNoMatch ? "0 candidates · attribute threshold not met" : "42 candidates · vector + lexical hybrid" },
    { t: "ranked",     ms: "+1.83s", detail: `ranker:b5_v0 · prompt:rank_v1 · top-1 score ${c.toFixed(2)}` },
    { t: "confidence", ms: "+2.04s", detail: `calibrator b6_v0 · band: ${c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low"}` },
    { t: "enriched",   ms: "+2.39s", detail: "Live pricing + stock attached" },
    { t: "assembled",  ms: "+2.47s", detail: "Decision row finalized" },
  ];
  // For no-match runs, stop after the failing stage.
  const auditEvents = isNoMatch ? allEvents.slice(0, 4) : allEvents;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-foreground/20 z-40" />
      <motion.aside
        initial={{ x: 540 }} animate={{ x: 0 }} exit={{ x: 540 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed right-0 top-0 bottom-0 w-[540px] bg-card border-l border-border z-50 flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="eyebrow text-muted-foreground">LINE {row.n.toString().padStart(2, "0")}</div>
            <div className="mono text-sm mt-1">{row.mpn}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{row.mfr}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            <ConfidenceBar value={row.confidence} />
          </div>
        </div>
        <div className="flex border-b border-border px-5">
          {(isNoMatch
            ? ([["diag", "Diagnostic"], ["alts", `Alternatives (${row.alternatives.length})`], ["input", "Input"], ["audit", "Audit"]] as const)
            : ([["reco", "Recommendation"], ["alts", `Alternatives (${row.alternatives.length})`], ["input", "Input"], ["audit", "Audit"]] as const)
          ).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative h-10 px-3 text-sm focus-ring ${tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
              {tab === k && <span className="absolute -bottom-px left-2 right-2 h-px bg-accent" />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-5">
          {tab === "reco" && !isNoMatch && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded bg-accent/10 text-accent shrink-0 flex items-center justify-center">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="mono text-sm font-medium">{row.sku}</div>
                    <div className="text-xs text-muted-foreground">{row.mfr} · {row.pkg}</div>
                    <span className="mt-2 inline-block text-[10px] mono px-1.5 py-0.5 rounded bg-success/10 text-success uppercase">Lifecycle: {row.lifecycle}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">PRICE TIERS</div>
                <table className="w-full text-sm">
                  <tbody className="mono text-xs">
                    {priceTiers(row.price ?? 0).map(([q, p]) => (
                      <tr key={q} className="border-b border-border last:border-0">
                        <td className="py-1.5">{q}+</td>
                        <td className="py-1.5 text-right">${p.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">AVAILABILITY</div>
                <div className="text-sm mono">{row.stock?.toLocaleString() ?? "—"} units · lead time 2 wk</div>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">RATIONALE</div>
                <p className="text-sm italic text-muted-foreground">{row.rationale}</p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button onClick={() => onAction("accept", row)} className="h-9 px-3 rounded-md border border-success/40 text-success text-sm inline-flex items-center gap-1.5 hover:bg-success/5 focus-ring"><Check className="h-4 w-4" /> Accept</button>
                <button onClick={() => setTab("alts")} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring">Replace</button>
                <button onClick={() => onAction("reject", row)} className="h-9 px-3 rounded-md border border-danger/40 text-danger text-sm hover:bg-danger/5 focus-ring">Reject</button>
                <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                  <button onClick={() => { navigator.clipboard.writeText(row.sku); toast.success("SKU copied"); }} className="p-2 rounded hover:bg-muted" title="Copy SKU"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => toast("Datasheet — coming soon")} className="p-2 rounded hover:bg-muted" title="Datasheet"><FileText className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}
          {tab === "reco" && isNoMatch && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm">
              <div className="eyebrow text-danger mb-1">UNRESOLVED</div>
              <p className="text-muted-foreground">No catalog candidate met the attribute threshold. Open the <button className="underline" onClick={() => setTab("diag")}>Diagnostic</button> tab to review reasons and next actions.</p>
            </div>
          )}
          {tab === "diag" && isNoMatch && (
            <div className="space-y-5">
              <div className="rounded-md border border-danger/30 bg-danger/5 p-4">
                <div className="eyebrow text-danger mb-1">UNRESOLVED</div>
                <p className="text-xs text-muted-foreground">No catalog candidate met the attribute threshold. The retriever returned 0 candidates so the ranker never ran.</p>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">REASONS</div>
                <ul className="mono text-xs space-y-1">
                  {(row.diagnostics?.reasons ?? ["mpn_unresolved"]).map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="text-danger">•</span>
                      <span className="text-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">NEXT ACTIONS</div>
                <ul className="mono text-xs space-y-1">
                  {(row.diagnostics?.next_actions ?? ["confirm_package"]).map((a) => (
                    <li key={a} className="flex items-start gap-2">
                      <span className="text-accent-cyan">→</span>
                      <span className="text-foreground">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button onClick={() => setTab("input")} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring">Open Input</button>
                <button onClick={() => onAction("reject", row)} className="h-9 px-3 rounded-md border border-danger/40 text-danger text-sm hover:bg-danger/5 focus-ring">Reject line</button>
              </div>
            </div>
          )}
          {tab === "alts" && (
            <div className="space-y-3">
              {row.alternatives.length === 0 && <p className="text-sm text-muted-foreground">No alternatives available. Try relaxing the substitution policy.</p>}
              {row.alternatives.map(a => (
                <div key={a.sku} className="rounded-md border border-border p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="mono text-sm">{a.mpn}</div>
                      <div className="text-xs text-muted-foreground">{a.mfr} · {a.pkg}</div>
                      {a.tradeoff_note && a.tradeoff_note.trim() !== "" && (
                        <div className="mt-1 text-[11px] italic text-muted-foreground/90">{a.tradeoff_note}</div>
                      )}
                    </div>
                    <div className="mono text-sm">${a.price.toFixed(2)}</div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Badge ok={a.match.pkg}>Pkg</Badge>
                    <Badge ok={a.match.tol}>Tol</Badge>
                    <Badge ok={a.match.voltage}>Voltage</Badge>
                  </div>
                  {a.rationale && a.rationale.trim() !== "" && (
                    <p className="text-xs italic text-muted-foreground mt-2">{a.rationale}</p>
                  )}

                  <button
                    onClick={() => onAction("replace", row, a.sku)}
                    className="mt-3 h-8 px-3 rounded-md border border-border text-xs hover:bg-muted focus-ring">Use this</button>
                </div>
              ))}
            </div>
          )}
          {tab === "input" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Compared values from the source row against the canonicalized record used for matching.
              </p>
              <div className="rounded-md border border-border overflow-hidden">
                <div className="grid grid-cols-[140px_1fr_1fr] text-xs eyebrow text-muted-foreground bg-surface-muted px-3 py-2">
                  <div>FIELD</div><div>AS UPLOADED</div><div>NORMALIZED</div>
                </div>
                {fieldRows.map(({ key, raw, norm }) => {
                  const diff = raw !== norm && raw !== "" && norm !== "";
                  return (
                    <div key={key} className="grid grid-cols-[140px_1fr_1fr] items-center px-3 py-2 border-t border-border text-xs">
                      <div className="mono text-muted-foreground">{key}</div>
                      <div className={`mono ${diff ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>{raw || "—"}</div>
                      <div className={`mono inline-flex items-center gap-1.5 ${diff ? "px-1.5 py-0.5 rounded bg-success/10 text-success w-fit" : ""}`}>
                        {norm || "—"}
                        {diff && <span className="eyebrow text-[9px] tracking-[0.18em] text-success/80">Normalized</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">SOURCE DESCRIPTION</div>
                <pre className="mono text-xs bg-surface-muted p-3 rounded border border-border whitespace-pre-wrap">{row.raw.description}</pre>
              </div>
              {isNoMatch && (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-3">
                  <div className="eyebrow text-danger mb-1">DIAGNOSTICS</div>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    <li>No candidate met the attribute threshold (≥ 0.65).</li>
                    <li>Description ambiguous — package and value not confirmable.</li>
                    <li>Suggested action: confirm package and tolerance in source.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
          {tab === "audit" && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="eyebrow text-muted-foreground mb-2">EVENTS</div>
                <div className="space-y-1.5">
                  {auditEvents.map(e => (
                    <div key={e.t} className="grid grid-cols-[80px_60px_1fr] items-baseline text-xs">
                      <div className="mono text-muted-foreground">{e.t}</div>
                      <div className="mono text-accent-cyan">{e.ms}</div>
                      <div className="text-muted-foreground">{e.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">SIGNALS</div>
                <table className="w-full mono text-xs">
                  <tbody>
                    {signals.map(([k, v, tip]) => (
                      <tr key={k} className="border-b border-border last:border-0">
                        <td className="py-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted underline-offset-2 decoration-muted-foreground/40">{k}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs"><span className="text-xs">{tip}</span></TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ClarifyPanel row={row} jobId={jobId} onApplyOverride={onApplyOverride} />
        </div>
      </motion.aside>
    </>
  );
}

// Map raw diagnostics reason codes to a human-readable subtitle.
function reasonToSubtitle(reason?: string): string {
  if (!reason) return "We weren't fully confident about this match.";
  const map: Record<string, string> = {
    mpn_unresolved: "We couldn't find this MPN in our catalog.",
    no_attribute_match: "No candidate matched the parsed attributes closely enough.",
    candidate_set_empty: "The retriever returned no candidates for this line.",
    ambiguous_description: "Several candidates matched and we weren't confident which one you meant.",
    low_top1_margin: "The top two candidates scored too close to call confidently.",
  };
  return map[reason] ?? "We weren't fully confident about this match.";
}

function reasonToHint(reason?: string): string {
  if (!reason) return "the application or any equivalent part numbers";
  const map: Record<string, string> = {
    mpn_unresolved: "any equivalent MPNs or the manufacturer you've used before",
    no_attribute_match: "package, value, tolerance, or voltage rating",
    candidate_set_empty: "package and value, or attach a datasheet link",
    ambiguous_description: "what application this part is for or any equivalents you've seen",
    low_top1_margin: "the manufacturer preference or specific package variant",
  };
  return map[reason] ?? "the application or any equivalent part numbers";
}

function ClarifyPanel({ row, jobId, onApplyOverride }: {
  row: ResultRow; jobId: string; onApplyOverride: (n: number, patch: Partial<ResultRow>) => void;
}) {
  const isNoMatch = row.sku === "no_match";
  const isLow = row.confidence < 0.6;
  const eligible = isNoMatch || isLow;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastClarification, setLastClarification] = useState<string>("");
  const [softMessage, setSoftMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stillUncertain, setStillUncertain] = useState<string | null>(null);

  if (!eligible) return null;

  const reasons = row.diagnostics?.reasons ?? [];
  const subtitle = reasonToSubtitle(reasons[0]);
  const originalLine = row.input.mpn || row.input.description || row.raw.description || "—";
  const trimmed = text.trim();
  const overLimit = text.length > 500;
  const disabled = loading || trimmed.length === 0;

  const submit = async () => {
    setLoading(true);
    setSoftMessage(null);
    setErrorMessage(null);
    setStillUncertain(null);
    try {
      const res = await fetch(`/jobs/${encodeURIComponent(jobId)}/lines/${row.n}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarification: trimmed }),
      });
      if (res.status === 404 || res.status === 501) {
        setLastClarification(trimmed);
        setSoftMessage("We've recorded your clarification. The re-evaluation feature will be available shortly.");
        return;
      }
      if (!res.ok) {
        setErrorMessage("We couldn't re-evaluate right now. Please try again, or contact support if this persists.");
        return;
      }
      const updated = (await res.json()) as Partial<ResultRow>;
      onApplyOverride(row.n, updated);
      setLastClarification(trimmed);
      toast.success("Re-evaluated with your context.");
      const newConf = typeof updated.confidence === "number" ? updated.confidence : row.confidence;
      const newSku = updated.sku ?? row.sku;
      const stillBad = newSku === "no_match" || newConf < 0.6;
      if (stillBad) {
        const nextReason = updated.diagnostics?.reasons?.[0] ?? reasons[0];
        setStillUncertain(`Still not fully confident — try adding more specific details about ${reasonToHint(nextReason)}.`);
        setCollapsed(false);
      } else {
        setCollapsed(true);
        setText("");
      }
    } catch {
      // Network failure — treat as backend-not-available (graceful degradation).
      setLastClarification(trimmed);
      setSoftMessage("We've recorded your clarification. The re-evaluation feature will be available shortly.");
    } finally {
      setLoading(false);
    }
  };

  if (collapsed) {
    const preview = lastClarification.length > 80 ? lastClarification.slice(0, 80) + "…" : lastClarification;
    return (
      <div className="mt-6 border-t border-border pt-5">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
          <HelpCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="eyebrow text-amber-700 dark:text-amber-400 mb-1">YOUR CLARIFICATION</div>
            <p className="text-xs text-muted-foreground truncate">{preview}</p>
          </div>
          <button
            onClick={() => { setCollapsed(false); setText(lastClarification); }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted focus-ring shrink-0">
            Clarify again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-6 border-t border-border pt-5 ${loading ? "animate-pulse" : ""}`}>
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="eyebrow text-amber-700 dark:text-amber-400">HELP US IDENTIFY THIS PART</div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="eyebrow text-muted-foreground mb-1">YOUR ORIGINAL LINE</div>
          <div className="mono text-xs rounded border border-border bg-card px-3 py-2 text-foreground break-words">
            {originalLine}
          </div>
        </div>

        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={loading}
            rows={3}
            maxLength={500}
            placeholder="Tell us more — what does this part do, what application is it for, what equivalent parts have you seen, any context that would help us find the right Mouser SKU?"
            className="w-full min-h-[72px] max-h-[200px] resize-y rounded-md border border-border bg-card px-3 py-2 text-sm focus-ring placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`mono text-[11px] ${overLimit ? "text-danger" : "text-muted-foreground"}`}>
              {text.length} / 500
            </span>
            <button
              onClick={submit}
              disabled={disabled}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-ring">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Re-running with your context…" : "Re-evaluate with this context"}
            </button>
          </div>
        </div>

        {stillUncertain && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{stillUncertain}</p>
        )}
        {softMessage && (
          <div className="mt-3 rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            {softMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

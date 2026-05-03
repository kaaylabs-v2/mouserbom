import { useParams, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { getResults } from "@/lib/mockApi";
import { ResultRow } from "@/lib/mockData";
import { ConfidenceBar, StockBar } from "@/components/atoms";
import { ChevronRight, Download, Code2, Share2, Search, MoreHorizontal, X, Check, Copy, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FilterBand = "high" | "med" | "low";

export default function Results() {
  const { jobId } = useParams();
  const rows = useMemo(() => getResults(jobId ?? ""), [jobId]);
  const [search, setSearch] = useSearchParams();
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [drawerRow, setDrawerRow] = useState<ResultRow | null>(null);
  const [tab, setTab] = useState<"recommendations" | "no-match" | "flagged" | "history">("recommendations");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const q = search.get("q") ?? "";
  const inStock = search.get("stock") === "1";
  const hasAlts = search.get("alts") === "1";
  const bandsParam = search.get("bands");
  const bands = new Set<FilterBand>(bandsParam ? (bandsParam.split(",") as FilterBand[]) : ["high", "med", "low"]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (tab === "no-match" && r.confidence > 0.5 && r.sku !== "no_match") return false;
      if (tab === "flagged" && r.confidence >= 0.85) return false;
      if (q && !(r.sku + r.mpn + r.mfr).toLowerCase().includes(q.toLowerCase())) return false;
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

  const exportCsv = () => {
    const headers = ["#", "SKU", "MPN", "Manufacturer", "Package", "Price", "Stock", "Confidence"];
    const lines = [headers.join(",")].concat(
      rows.map(r => [r.n, r.sku, r.mpn, r.mfr, r.pkg, r.price ?? "", r.stock ?? "", r.confidence].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${jobId}-results.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-14 z-20">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center gap-4">
          <div>
            <input
              defaultValue="MainBoard-v4.csv"
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
            <button onClick={exportCsv} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
              <Code2 className="h-4 w-4" /> API
            </button>
            <button className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-2">
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
          <Stat label="No-match lines" value={`${stats.noMatch}`} sub="Resolve" subAccent />
          <Stat label="Total est. cost @ qty" value={`$${stats.cost.toFixed(2)}`} sub="USD" />
        </div>

        {/* Filter bar */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => updateParam("q", e.target.value)}
              placeholder="Search MPN, manufacturer, description"
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
                  onOpen={() => setDrawerRow(r)}
                  selected={selected.has(r.n)}
                  onSelect={() => {
                    const next = new Set(selected);
                    next.has(r.n) ? next.delete(r.n) : next.add(r.n);
                    setSelected(next);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-sm text-muted-foreground">No lines match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky multi-select bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-navy text-navy-foreground rounded-lg border border-border px-4 py-2.5 flex items-center gap-3 z-30">
            <span className="mono text-xs">{selected.size} selected</span>
            <div className="h-4 w-px bg-navy-foreground/20" />
            <button className="text-sm px-2 py-1 rounded hover:bg-white/10">Replace with alternative</button>
            <button className="text-sm px-2 py-1 rounded hover:bg-white/10">Reject</button>
            <button className="text-sm px-2 py-1 rounded hover:bg-white/10">Export selected</button>
            <button onClick={() => setSelected(new Set())} className="ml-1 p-1 rounded hover:bg-white/10"><X className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Line drawer */}
      <AnimatePresence>
        {drawerRow && <LineDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, sub, bar, subAccent }: { label: string; value: string; sub?: string; bar?: number; subAccent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 mono text-2xl font-semibold tabular-nums">{value}</div>
      {bar != null && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
      {sub && <div className={`mt-2 text-xs ${subAccent ? "text-accent cursor-pointer hover:underline" : "text-muted-foreground"}`}>{sub}</div>}
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

function Row({ r, open, onToggle, onOpen, selected, onSelect }: {
  r: ResultRow; open: boolean; onToggle: () => void; onOpen: () => void; selected: boolean; onSelect: () => void;
}) {
  const isNoMatch = r.sku === "no_match";
  return (
    <>
      <tr
        className={`group border-b border-border last:border-0 hover:bg-surface-muted relative cursor-pointer ${isNoMatch ? "" : ""}`}
        onClick={(e) => {
          // Don't open drawer if clicking interactive children
          const t = e.target as HTMLElement;
          if (t.closest("button, input, [data-noclick]")) return;
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
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            {!isNoMatch && (
              <button onClick={(e) => { e.stopPropagation(); onToggle(); }} data-noclick
                className={`h-5 w-5 rounded hover:bg-muted flex items-center justify-center transition-transform ${open ? "rotate-90" : ""}`}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            <span className={`mono text-sm ${isNoMatch ? "text-muted-foreground italic" : ""}`}>{isNoMatch ? "(unresolved)" : r.sku}</span>
          </div>
        </td>
        <td className="px-3 py-3 mono text-xs">{r.mpn}</td>
        <td className="px-3 py-3 text-sm">{r.mfr}</td>
        <td className="px-3 py-3"><span className="text-xs px-1.5 py-0.5 rounded bg-muted mono">{r.pkg}</span></td>
        <td className="px-3 py-3 mono text-sm text-right tabular-nums">{r.price != null ? `$${r.price.toFixed(2)}` : "—"}</td>
        <td className="px-3 py-3"><StockBar stock={r.stock} /></td>
        <td className="px-3 py-3">
          {r.alts > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); onOpen(); }} data-noclick
              className="text-xs mono px-2 py-0.5 rounded bg-muted hover:bg-border">
              {r.alts} ▸
            </button>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-3"><ConfidenceBar value={r.confidence} /></td>
        <td className="px-3 py-3 text-muted-foreground" data-noclick>
          <button className="p-1 rounded hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
        </td>
      </tr>
      <AnimatePresence>
        {open && !isNoMatch && (
          <tr>
            <td colSpan={10} className="bg-surface-muted border-b border-border p-0">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="px-8 py-5 grid grid-cols-3 gap-4">
                  <div className="col-span-3">
                    <div className="eyebrow text-muted-foreground mb-1">RATIONALE</div>
                    <p className="text-sm italic text-muted-foreground">{r.rationale}</p>
                  </div>
                  {r.alternatives.map((a) => (
                    <div key={a.sku} className="rounded-md border border-border bg-card p-3">
                      <div className="mono text-xs text-muted-foreground">{a.mfr}</div>
                      <div className="mono text-sm font-medium mt-0.5">{a.mpn}</div>
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
                      <button className="mt-3 w-full h-8 rounded-md border border-border text-xs hover:bg-muted focus-ring">Use this</button>
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

function LineDrawer({ row, onClose }: { row: ResultRow; onClose: () => void }) {
  const [tab, setTab] = useState<"reco" | "alts" | "input" | "audit">("reco");
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-foreground/20 z-40" />
      <motion.aside
        initial={{ x: 540 }} animate={{ x: 0 }} exit={{ x: 540 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed right-0 top-0 bottom-0 w-[540px] bg-card border-l border-border z-50 flex flex-col"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
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
          {([["reco", "Recommendation"], ["alts", `Alternatives (${row.alternatives.length})`], ["input", "Input"], ["audit", "Audit"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative h-10 px-3 text-sm focus-ring ${tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
              {tab === k && <span className="absolute -bottom-px left-2 right-2 h-px bg-accent" />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-5">
          {tab === "reco" && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded bg-muted shrink-0" />
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
                    {[[1, row.price ?? 0], [10, (row.price ?? 0) * 0.92], [100, (row.price ?? 0) * 0.84], [1000, (row.price ?? 0) * 0.71]].map(([q, p]) => (
                      <tr key={q} className="border-b border-border last:border-0">
                        <td className="py-1.5">{q}+</td>
                        <td className="py-1.5 text-right">${(p as number).toFixed(4)}</td>
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
                <button className="h-9 px-3 rounded-md border border-success/40 text-success text-sm inline-flex items-center gap-1.5 hover:bg-success/5 focus-ring"><Check className="h-4 w-4" /> Accept</button>
                <button onClick={() => setTab("alts")} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring">Replace</button>
                <button className="h-9 px-3 rounded-md border border-danger/40 text-danger text-sm hover:bg-danger/5 focus-ring">Reject</button>
                <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                  <button className="p-2 rounded hover:bg-muted" title="Copy SKU"><Copy className="h-4 w-4" /></button>
                  <button className="p-2 rounded hover:bg-muted" title="Datasheet"><FileText className="h-4 w-4" /></button>
                </div>
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
                    </div>
                    <div className="mono text-sm">${a.price.toFixed(2)}</div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Badge ok={a.match.pkg}>Pkg</Badge>
                    <Badge ok={a.match.tol}>Tol</Badge>
                    <Badge ok={a.match.voltage}>Voltage</Badge>
                  </div>
                  <p className="text-xs italic text-muted-foreground mt-2">{a.rationale}</p>
                  <button className="mt-3 h-8 px-3 rounded-md border border-border text-xs hover:bg-muted focus-ring">Use this</button>
                </div>
              ))}
            </div>
          )}
          {tab === "input" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="eyebrow text-muted-foreground mb-2">AS UPLOADED</div>
                <pre className="mono text-xs bg-surface-muted p-3 rounded border border-border whitespace-pre-wrap">{JSON.stringify(row.raw, null, 2)}</pre>
              </div>
              <div>
                <div className="eyebrow text-muted-foreground mb-2">NORMALIZED</div>
                <pre className="mono text-xs bg-surface-muted p-3 rounded border border-border whitespace-pre-wrap">
{JSON.stringify({ mpn: row.mpn, manufacturer: row.mfr, package: row.pkg, qty: row.qty }, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {tab === "audit" && (
            <div className="space-y-3 text-sm">
              <AuditEvent t="parsed" detail="Row parsed from spreadsheet column map v2" />
              <AuditEvent t="retrieved" detail="42 candidates · vector + lexical hybrid" />
              <AuditEvent t="ranked" detail="ranker:v3.4 · top-1 score 0.94" />
              <AuditEvent t="confidence" detail={`band: ${row.confidence >= 0.85 ? "high" : row.confidence >= 0.6 ? "medium" : "low"}`} />
              <div>
                <div className="eyebrow text-muted-foreground mb-2 mt-4">SIGNALS</div>
                <table className="w-full mono text-xs">
                  <tbody>
                    {[["mpn_exact", row.confidence > 0.85 ? "1.00" : "0.41"], ["pkg_match", "1.00"], ["mfr_pref", "0.92"], ["lifecycle", row.lifecycle === "active" ? "1.00" : "0.20"]].map(([k, v]) => (
                      <tr key={k} className="border-b border-border last:border-0">
                        <td className="py-1.5">{k}</td>
                        <td className="py-1.5 text-right">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

function AuditEvent({ t, detail }: { t: string; detail: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <div className="mono text-muted-foreground w-24 shrink-0">{t}</div>
      <div className="flex-1">{detail}</div>
    </div>
  );
}

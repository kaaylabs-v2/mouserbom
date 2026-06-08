import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchCatalog, type CatalogItem } from "@/lib/api";

const LIMIT = 25;

// Lifecycle badge by severity (matches the palette; lifecycle may arrive
// capitalized from the catalog, so normalize before mapping).
function lifecycleClass(lc: string): string {
  switch (lc.toLowerCase()) {
    case "active":
      return "bg-success/10 text-success";
    case "nrnd":
    case "preview":
    case "ltb":
      return "bg-warn/10 text-warn";
    case "obsolete":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function fmtPrice(p: CatalogItem["price"]): string {
  return p ? `$${p.amount.toFixed(4)}` : "—";
}

export default function Catalog() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["catalog", search, page],
    queryFn: () => fetchCatalog(search, page, LIMIT),
    placeholderData: keepPreviousData,
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(input);
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const items = data?.items ?? [];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow text-muted-foreground">CATALOG</div>
          <h1 className="text-2xl mt-1">Browse the Mouser catalog</h1>
        </div>
        <span className="mono text-xs text-muted-foreground">
          {total.toLocaleString()} parts
        </span>
      </div>

      <form onSubmit={submitSearch} className="mt-6 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search MPN, manufacturer, or description…"
          className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-card text-sm focus-ring"
        />
      </form>

      <div className="mt-6 rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-surface-muted">
            <tr className="border-b border-border">
              <th className="text-left font-medium px-4 py-2.5">MPN</th>
              <th className="text-left font-medium px-3 py-2.5">Manufacturer</th>
              <th className="text-left font-medium px-3 py-2.5">Description</th>
              <th className="text-left font-medium px-3 py-2.5">Package</th>
              <th className="text-right font-medium px-3 py-2.5">Price</th>
              <th className="text-right font-medium px-3 py-2.5">Stock</th>
              <th className="text-left font-medium px-3 py-2.5">Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {isError && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-danger">
                  Failed to load catalog: {String(error)}
                </td>
              </tr>
            )}
            {!isError && items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  {isFetching ? "Loading…" : "No parts match this search."}
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.sku} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 mono text-xs">{it.mpn}</td>
                <td className="px-3 py-3">{it.manufacturer}</td>
                <td className="px-3 py-3 max-w-[360px] truncate text-muted-foreground">
                  {it.description}
                </td>
                <td className="px-3 py-3">
                  {it.package ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted mono">{it.package}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-right mono tabular-nums">{fmtPrice(it.price)}</td>
                <td className="px-3 py-3 text-right mono tabular-nums">
                  {it.stock.toLocaleString()}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[10px] mono px-1.5 py-0.5 rounded uppercase ${lifecycleClass(it.lifecycle)}`}
                  >
                    {it.lifecycle}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground mono">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
            className="h-8 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
            className="h-8 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring inline-flex items-center gap-1 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Results table — column-alignment rendering test.
 *
 * Guards the demo-breaking bug where a malformed <td> (the "Your line" cell
 * left unclosed, so "Recommended part" nested inside it) collapsed two
 * columns into one: the row then had one fewer direct <td> than the header
 * had <th>, shifting every column from "Recommended part" rightward one slot
 * left (MPN showed manufacturer, Manufacturer showed package, etc.).
 *
 * The assertion mirrors how a browser maps cells to columns: the Nth DIRECT
 * <td> child of the row aligns with the Nth <th>. We therefore check the
 * row's *direct-child* <td>s (not getAllByRole, which also returns nested
 * <td>s) against the header order — so a collapsed/nested cell fails both the
 * count check and the per-column value checks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ResultRow } from "@/lib/mockData";

vi.mock("@/lib/api", () => ({
  fetchResults: vi.fn(),
  fetchJobMeta: vi.fn(),
  downloadMouserQuote: vi.fn(),
}));

import Results from "@/pages/Results";
import { fetchResults, fetchJobMeta } from "@/lib/api";

function makeRow(o: Partial<ResultRow> & Pick<ResultRow, "n" | "sku" | "mpn">): ResultRow {
  return {
    mfr: "—",
    pkg: "—",
    price: null,
    stock: null,
    alts: 0,
    confidence: 0.5,
    rationale: "",
    lifecycle: "active",
    qty: 1,
    alternatives: [],
    raw: { description: "", mpn: o.mpn, qty: o.qty ?? 1 },
    input: { mpn: o.mpn },
    ...o,
  };
}

// Two real matched lines (the Disney-PDF shape). Distinct values per field so
// any one-column shift surfaces as a wrong value under a header.
const ROWS: ResultRow[] = [
  makeRow({
    n: 1,
    sku: "332-ESP32-WROOM-32E",
    mpn: "ESP32-WROOM-32E",
    mfr: "Espressif Systems",
    pkg: "Module",
    price: 3.87,
    stock: 19167,
    confidence: 0.09,
    qty: 3,
    input: { mpn: "ESP32-WROOM-32E, 4MB FLASH" },
  }),
  makeRow({
    n: 2,
    sku: "290-W25Q128JVSIQ",
    mpn: "W25Q128JVSIQ",
    mfr: "Winbond Electronics",
    pkg: "SOIC-8",
    price: 1.95,
    stock: 0,
    confidence: 0.6,
    qty: 5,
    input: { mpn: "W25Q128JVSIQ" },
  }),
];

function renderResults() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/jobs/JOB1/results"]}>
          <Routes>
            <Route path="/jobs/:jobId/results" element={<Results />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("Results table column alignment", () => {
  beforeEach(() => {
    vi.mocked(fetchResults).mockResolvedValue(ROWS);
    vi.mocked(fetchJobMeta).mockResolvedValue({
      file: "sample-rfq-form.pdf",
      lines: ROWS.length,
      createdAt: "",
    });
  });

  it("renders each field under its OWN column header", async () => {
    const { container } = renderResults();

    // Wait for the async-loaded row to appear.
    await waitFor(() => expect(screen.getByText("332-ESP32-WROOM-32E")).toBeInTheDocument());

    // Header order (direct <th> of the head row).
    const headTr = container.querySelector("table thead tr")!;
    const headers = Array.from(headTr.querySelectorAll(":scope > th")).map((th) =>
      (th.textContent ?? "").trim()
    );

    // The data row = the <tr> whose recommended-part cell holds the SKU.
    const skuCell = screen.getByText("332-ESP32-WROOM-32E");
    const dataTr = skuCell.closest("tr")!;
    const cells = Array.from(dataTr.querySelectorAll(":scope > td"));

    // The collapsed-<td> bug makes this row have FEWER direct cells than the
    // header has columns — this single assertion catches the whole class.
    expect(cells.length).toBe(headers.length);

    const cellUnder = (label: string) => {
      const idx = headers.indexOf(label);
      expect(idx, `header "${label}" must exist`).toBeGreaterThanOrEqual(0);
      return (cells[idx].textContent ?? "").trim();
    };

    expect(cellUnder("Recommended part")).toContain("332-ESP32-WROOM-32E");
    expect(cellUnder("MPN")).toBe("ESP32-WROOM-32E");
    expect(cellUnder("Manufacturer")).toBe("Espressif Systems");
    expect(cellUnder("Pkg")).toBe("Module");
    expect(cellUnder("Price")).toContain("$3.87");
    expect(cellUnder("Avail.")).toContain("19,167");
  });

  it("uses real (non-zero) qty in the computed total est. cost", async () => {
    renderResults();
    await waitFor(() => expect(screen.getByText("332-ESP32-WROOM-32E")).toBeInTheDocument());

    // qty must be the real parsed quantity, not 0.
    for (const r of ROWS) expect(r.qty).toBeGreaterThan(0);

    // Total est. cost @ qty = Σ price × qty = 3.87*3 + 1.95*5 = 21.36.
    const expectedTotal = ROWS.reduce((a, r) => a + (r.price ?? 0) * r.qty, 0);
    expect(expectedTotal).toBeCloseTo(21.36, 2);

    // Stat renders label + value as sibling <div>s inside the card; the card
    // is the label div's parent.
    const totalCard = screen.getByText("Total est. cost @ qty").parentElement!;
    expect(within(totalCard).getByText(`$${expectedTotal.toFixed(2)}`)).toBeInTheDocument();
  });
});

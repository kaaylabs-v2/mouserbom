/**
 * Rendered-output guard for lifecycle display (not just the mapper — the
 * column-bug lesson: test the render). A non-active lifecycle must actually
 * SHOW its real value in the drawer, with a non-green (severity) badge.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    mfr: "STMicroelectronics",
    pkg: "LQFP-100",
    price: 9.88,
    stock: 1200,
    alts: 0,
    confidence: 0.9,
    rationale: "",
    lifecycle: "active",
    qty: 2,
    alternatives: [],
    raw: { description: "", mpn: o.mpn, qty: o.qty ?? 1 },
    input: { mpn: o.mpn },
    ...o,
  };
}

function renderResults(rows: ResultRow[]) {
  vi.mocked(fetchResults).mockResolvedValue(rows);
  vi.mocked(fetchJobMeta).mockResolvedValue({ file: "bom.xlsx", lines: rows.length, createdAt: "" });
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

describe("lifecycle display in the drawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a non-active lifecycle with its real value and a non-green badge", async () => {
    renderResults([
      makeRow({ n: 1, sku: "344-STM32F407VGT6", mpn: "STM32F407VGT6", lifecycle: "obsolete" }),
    ]);
    // Open the drawer by clicking the recommended-part cell.
    await waitFor(() => expect(screen.getByText("344-STM32F407VGT6")).toBeInTheDocument());
    fireEvent.click(screen.getByText("344-STM32F407VGT6"));

    const badge = await screen.findByText(/Lifecycle:\s*obsolete/i);
    expect(badge).toBeInTheDocument();
    // Severity colour: obsolete → danger, NOT the old always-green success.
    expect(badge.className).toContain("text-danger");
    expect(badge.className).not.toContain("text-success");
  });

  it("shows active with the green success badge", async () => {
    renderResults([
      makeRow({ n: 1, sku: "344-STM32F407VGT6", mpn: "STM32F407VGT6", lifecycle: "active" }),
    ]);
    await waitFor(() => expect(screen.getByText("344-STM32F407VGT6")).toBeInTheDocument());
    fireEvent.click(screen.getByText("344-STM32F407VGT6"));

    const badge = await screen.findByText(/Lifecycle:\s*active/i);
    expect(badge.className).toContain("text-success");
  });
});

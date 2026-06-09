/**
 * Results header — run-metrics chip (elapsed + estimated cost).
 *
 * v1 surfaces two numbers the backend already records on GET /jobs/{id}:
 * server-side pipeline elapsed (duration_ms) and estimated LLM cost
 * (sum of stage_cost_usd). NO backend change — this only renders them.
 *
 * Graceful degradation is the feature under test, not just a guard:
 *   (i)   normal completed run  → "Processed in <t> · ~$<cost>"
 *   (ii)  completed, NO LLM ran → "~$0.00 · no AI calls needed" (true zero,
 *         never $undefined/NaN) — this is the exact-MPN-tiebreak path
 *   (iii) still-processing job  → no metrics yet → NO chip at all
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const ROW: ResultRow = {
  n: 1,
  sku: "595-TPS54360DDAR",
  mpn: "TPS54360DDAR",
  mfr: "Texas Instruments",
  pkg: "SOIC-8",
  price: 1.23,
  stock: 5000,
  alts: 0,
  confidence: 0.97,
  rationale: "",
  lifecycle: "active",
  qty: 1,
  alternatives: [],
  raw: { description: "", mpn: "TPS54360DDAR", qty: 1 },
  input: { mpn: "TPS54360DDAR" },
};

type JobMeta = Awaited<ReturnType<typeof fetchJobMeta>>;

function mockMeta(partial: Partial<JobMeta>) {
  vi.mocked(fetchJobMeta).mockResolvedValue({
    file: "bom.xlsx",
    lines: 1,
    createdAt: "",
    durationMs: null,
    costUsd: null,
    ...partial,
  });
}

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

describe("Results run-metrics chip", () => {
  beforeEach(() => {
    vi.mocked(fetchResults).mockResolvedValue([ROW]);
  });

  it("(i) renders elapsed + estimated cost for a normal completed run", async () => {
    mockMeta({ durationMs: 11400, costUsd: 0.33 });
    renderResults();
    await waitFor(() => expect(screen.getByText("595-TPS54360DDAR")).toBeInTheDocument());

    const chip = screen.getByText(
      (t) => t.includes("Processed in 11.4s") && t.includes("~$0.33")
    );
    expect(chip).toBeInTheDocument();
    // Cost is always flagged as an estimate, never a billed figure.
    expect(chip.textContent).toContain("~$");
    // A real run with AI calls is NOT mislabeled as "no AI calls".
    expect(chip.textContent).not.toContain("no AI calls needed");
  });

  it("(ii) shows ~$0.00 + 'no AI calls needed' when no LLM ran (exact-MPN tiebreak)", async () => {
    // duration present, cost a true zero (stage_cost_usd absent on the backend).
    mockMeta({ durationMs: 420, costUsd: 0 });
    renderResults();
    await waitFor(() => expect(screen.getByText("595-TPS54360DDAR")).toBeInTheDocument());

    const chip = screen.getByText(
      (t) => t.includes("Processed in 420ms") && t.includes("no AI calls needed")
    );
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain("~$0.00");
    // Degradation is graceful — never the broken-data tells.
    expect(chip.textContent).not.toMatch(/undefined|NaN|\$NaN/);
  });

  it("(iii) renders NO chip for a still-processing job (no metrics yet)", async () => {
    // durationMs null → job hasn't finished → nothing to show.
    mockMeta({ durationMs: null, costUsd: null });
    renderResults();
    await waitFor(() => expect(screen.getByText("595-TPS54360DDAR")).toBeInTheDocument());

    expect(screen.queryByText(/Processed in/)).toBeNull();
    // And no degenerate placeholder leaked in its place.
    expect(screen.queryByText(/undefined|\$NaN|NaN/)).toBeNull();
  });
});

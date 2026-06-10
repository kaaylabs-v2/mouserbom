/**
 * Workspace dashboard — live-data rendering test.
 *
 * The landing page previously rendered 100% mock data (static "1,284 /
 * 94.2% / 11.4s" placeholders and a seeded recent-jobs list, zero backend
 * calls). These tests pin the live wiring:
 *   a) rows from GET /v1/jobs land under the correct column headers, and a
 *      failed job with null lines/matchRate renders "—" without crashing;
 *   b) the "At a glance" stats are COMPUTED from the job list (mean match
 *      rate over complete+partial), and the old mock placeholders are gone;
 *   c) an empty list shows the empty-state row, count "0", accuracy "—".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { RecentJob } from "@/lib/api";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer requires one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("@/lib/api", () => ({
  listRecentJobs: vi.fn(),
  createJob: vi.fn(),
}));

import Workspace from "@/pages/Workspace";
import { listRecentJobs } from "@/lib/api";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// Two complete jobs at matchRate 12/13 and 1.0 → mean 96.2%; one failed job
// with null lines/matchRate (the real backend shape for a failed run).
const JOBS: RecentJob[] = [
  {
    id: "job_AAA111",
    file: "drone-controller.xlsx",
    lines: 13,
    status: "complete",
    matchRate: 12 / 13,
    submitted: hoursAgo(2),
    durationMs: 11400,
  },
  {
    id: "job_BBB222",
    file: "power-stage.csv",
    lines: 8,
    status: "complete",
    matchRate: 1.0,
    submitted: hoursAgo(30),
    durationMs: 3000,
  },
  {
    id: "job_CCC333",
    file: "legacy-rev-a.pdf",
    lines: null,
    status: "failed",
    matchRate: null,
    submitted: hoursAgo(50),
    durationMs: null,
  },
];

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Workspace />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Workspace dashboard live data", () => {
  beforeEach(() => vi.mocked(listRecentJobs).mockReset());

  it("a) renders API rows under the correct headers; failed job shows — and doesn't crash", async () => {
    vi.mocked(listRecentJobs).mockResolvedValue(JOBS);
    const { container } = renderWorkspace();
    await waitFor(() => expect(screen.getByText("job_AAA111")).toBeInTheDocument());

    const headers = Array.from(container.querySelectorAll("table thead tr > th")).map((th) =>
      (th.textContent ?? "").trim()
    );
    const cellUnder = (tr: HTMLTableRowElement, label: string) => {
      const idx = headers.indexOf(label);
      expect(idx, `header "${label}" must exist`).toBeGreaterThanOrEqual(0);
      const cells = Array.from(tr.querySelectorAll(":scope > td"));
      expect(cells.length).toBe(headers.length);
      return (cells[idx].textContent ?? "").trim();
    };

    const okRow = screen.getByText("job_AAA111").closest("tr") as HTMLTableRowElement;
    expect(cellUnder(okRow, "File")).toContain("drone-controller.xlsx");
    expect(cellUnder(okRow, "Lines")).toBe("13");
    expect(cellUnder(okRow, "Status")).toContain("Complete");
    expect(cellUnder(okRow, "Match rate")).toBe("92%"); // 12/13 → 92%

    // The failed job: null lines + null matchRate render as "—", not a crash.
    const failedRow = screen.getByText("job_CCC333").closest("tr") as HTMLTableRowElement;
    expect(cellUnder(failedRow, "Lines")).toBe("—");
    expect(cellUnder(failedRow, "Match rate")).toBe("—");
    expect(cellUnder(failedRow, "Status")).toContain("Failed");
  });

  it("b) computes the stats from the job list; mock placeholders are gone", async () => {
    vi.mocked(listRecentJobs).mockResolvedValue(JOBS);
    renderWorkspace();
    await waitFor(() => expect(screen.getByText("job_AAA111")).toBeInTheDocument());

    // 3 jobs in the 30d window.
    const countCard = screen.getByText("BOMs processed (30d)").parentElement!;
    expect(countCard.textContent).toContain("3");
    // Mean match rate over the two complete jobs: (12/13 + 1.0)/2 → 96.2%.
    const accCard = screen.getByText("Avg. match accuracy").parentElement!;
    expect(accCard.textContent).toContain("96.2%");
    // Mean duration: (11400 + 3000)/2 ms → 7.2s.
    const durCard = screen.getByText("Avg. processing time").parentElement!;
    expect(durCard.textContent).toContain("7.2s");

    // The hardcoded mock numbers must be gone.
    expect(screen.queryByText("1,284")).toBeNull();
    expect(screen.queryByText("94.2%")).toBeNull();
    expect(screen.queryByText("11.4s")).toBeNull();
  });

  it("c) empty list → empty-state row, count 0, accuracy —", async () => {
    vi.mocked(listRecentJobs).mockResolvedValue([]);
    renderWorkspace();
    await waitFor(() => expect(screen.getByText(/No jobs yet/)).toBeInTheDocument());

    const countCard = screen.getByText("BOMs processed (30d)").parentElement!;
    expect(countCard.textContent).toContain("0");
    const accCard = screen.getByText("Avg. match accuracy").parentElement!;
    expect(accCard.textContent).toContain("—");
  });
});

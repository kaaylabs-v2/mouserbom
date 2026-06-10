/**
 * Processing — minimum stage-dwell pacing test (the "skips to step 4" fix).
 *
 * Diagnosed live: the engine and SSE replay are correct, but small files
 * finish stages 1-3 before this screen first paints; the history replay then
 * marks them complete in one frame, so they never visibly animate. The fix is
 * a paced event queue in Processing.tsx ONLY: each stage holds ACTIVE for
 * ≥ STAGE_DWELL_MS before flipping complete, replayed bursts drain in order,
 * and navigation to Results waits for the drain. Pure presentation pacing —
 * every state shown is one the engine really reached.
 *
 * The test feeds the replay scenario (a burst of already-completed stage
 * events plus the terminal complete event) under fake timers and asserts:
 *   1. pending → active → complete sequencing per stage, paced by the dwell;
 *   2. navigation does NOT fire until the queue has drained.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { StageEvent, ProgressEvent, CompleteEvent } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchJobMeta: vi.fn().mockResolvedValue({
    file: "tiny.pdf",
    lines: 2,
    createdAt: "",
    durationMs: null,
    costUsd: null,
  }),
  streamJobEvents: vi.fn(),
}));

import Processing from "@/pages/Processing";
import { streamJobEvents } from "@/lib/api";

const STAGES = [
  "ingest",
  "parse",
  "normalize",
  "retrieve",
  "rank",
  "confidence",
  "enrich",
  "assemble",
];
const DWELL = 350; // mirrors STAGE_DWELL_MS in Processing.tsx

interface Handlers {
  onStage?: (e: StageEvent) => void;
  onProgress?: (e: ProgressEvent) => void;
  onComplete?: (e: CompleteEvent) => void;
  onError?: (e: { message: string }) => void;
}

function renderProcessing() {
  let handlers: Handlers = {};
  vi.mocked(streamJobEvents).mockImplementation((_jobId, h) => {
    handlers = h as Handlers;
    return () => {};
  });
  const utils = render(
    <MemoryRouter initialEntries={["/jobs/JOB1"]}>
      <Routes>
        <Route path="/jobs/:jobId" element={<Processing />} />
        <Route path="/jobs/:jobId/results" element={<div data-testid="results-page" />} />
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, handlers: () => handlers };
}

const stateOf = (container: HTMLElement, stage: string) =>
  container.querySelector(`[data-stage="${stage}"]`)?.getAttribute("data-state");

describe("Processing stage dwell", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("paces a replayed burst: pending → active → complete per stage, in order", async () => {
    const { container, handlers } = renderProcessing();

    // The replay scenario: every stage already done, events arrive in one burst.
    await act(async () => {
      for (const s of STAGES) {
        handlers().onStage?.({ stage: s, status: "started" });
        handlers().onStage?.({ stage: s, status: "completed" });
      }
      handlers().onComplete?.({ job_id: "JOB1", result_id: "bom_X" });
    });

    // First paint after the burst: stage 1 is ACTIVE (not instantly complete),
    // later stages still pending — the burst did NOT all-green in one frame.
    expect(stateOf(container, "ingest")).toBe("active");
    expect(stateOf(container, "parse")).toBe("pending");
    expect(stateOf(container, "assemble")).toBe("pending");

    // One dwell: ingest completes, parse becomes the active stage.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL);
    });
    expect(stateOf(container, "ingest")).toBe("complete");
    expect(stateOf(container, "parse")).toBe("active");
    expect(stateOf(container, "normalize")).toBe("pending");

    // Another dwell: the cascade advances exactly one stage.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL);
    });
    expect(stateOf(container, "parse")).toBe("complete");
    expect(stateOf(container, "normalize")).toBe("active");

    // Drain the rest (2 dwells already elapsed → 6 remain = exactly 8 total).
    // Lands at full-drain but BEFORE the 500ms settle beat, so the stage strip
    // is still mounted: all stages complete, navigation not yet fired.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL * (STAGES.length - 2));
    });
    for (const s of STAGES) expect(stateOf(container, s)).toBe("complete");
  });

  it("never navigates to Results before the queue drains", async () => {
    const { container, queryByTestId, handlers } = renderProcessing();

    await act(async () => {
      for (const s of STAGES) {
        handlers().onStage?.({ stage: s, status: "started" });
        handlers().onStage?.({ stage: s, status: "completed" });
      }
      handlers().onComplete?.({ job_id: "JOB1", result_id: "bom_X" });
    });

    // Midway through the drain: still on Processing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL * 3);
    });
    expect(queryByTestId("results-page")).toBeNull();
    expect(stateOf(container, "assemble")).not.toBe("complete");

    // Full drain (8 dwells) + the 500ms settle beat → navigation fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DWELL * STAGES.length + 500);
    });
    expect(queryByTestId("results-page")).not.toBeNull();
  });

  it("a failed stage bypasses the dwell queue and surfaces immediately", async () => {
    const { container, handlers } = renderProcessing();

    await act(async () => {
      handlers().onStage?.({ stage: "ingest", status: "started" });
      handlers().onStage?.({ stage: "ingest", status: "completed" });
      handlers().onStage?.({ stage: "parse", status: "failed" });
    });

    // No timer advance at all: the failure is already visible.
    expect(stateOf(container, "parse")).toBe("failed");
  });
});

import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { fetchJobMeta, streamJobEvents } from "@/lib/api";

// The backend's eight pipeline stages (orchestrator event names) → labels.
const STAGE_DEFS: { key: string; label: string }[] = [
  { key: "ingest", label: "Ingest" },
  { key: "parse", label: "Parse" },
  { key: "normalize", label: "Normalize" },
  { key: "retrieve", label: "Retrieve" },
  { key: "rank", label: "Rank" },
  { key: "confidence", label: "Confidence" },
  { key: "enrich", label: "Enrich" },
  { key: "assemble", label: "Assemble" },
];

type StageState = "pending" | "active" | "complete" | "failed";

// Minimum time a stage stays visibly ACTIVE before it may flip to complete.
// Small files finish stages 1-3 before this screen first paints; the SSE
// history replay then marks them complete instantly and they never animate
// ("skips to step 4"). The dwell paces PRESENTATION only — the data shown is
// always a state the engine really reached, just never faster than the eye.
// Slow live runs are unaffected (a stage already active ≥ dwell flips
// immediately). Worst case added latency: 8 stages × 350ms = 2.8s.
const STAGE_DWELL_MS = 350;

type QueuedEvent =
  | { kind: "stage"; stage: string; status: "started" | "completed" }
  | { kind: "complete" };

export default function Processing() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const [stages, setStages] = useState<Record<string, StageState>>(() =>
    Object.fromEntries(STAGE_DEFS.map((s) => [s.key, "pending"]))
  );
  const [meta, setMeta] = useState<{ file: string } | null>(null);
  const [progress, setProgress] = useState<{ matched: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigated = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    fetchJobMeta(jobId)
      .then((m) => setMeta({ file: m.file }))
      .catch(() => setMeta({ file: jobId }));

    // Paced event queue: replayed/bursty events drain in order, each stage
    // holding ACTIVE for ≥ STAGE_DWELL_MS before completing. Failures and
    // stream errors BYPASS the queue and surface immediately. Navigation to
    // Results is itself queued, so it can never overtake the drain.
    let unmounted = false;
    const queue: QueuedEvent[] = [];
    const activeAt: Record<string, number> = {};
    let draining = false;

    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const markActive = (stage: string) => {
      activeAt[stage] ??= Date.now();
      setStages((prev) => (prev[stage] === "pending" ? { ...prev, [stage]: "active" } : prev));
    };

    const drain = async () => {
      if (draining) return;
      draining = true;
      try {
        while (queue.length > 0 && !unmounted) {
          const ev = queue.shift()!;
          if (ev.kind === "stage") {
            if (ev.status === "started") {
              markActive(ev.stage);
            } else {
              // A completed stage must have been visibly active first.
              markActive(ev.stage);
              const wait = activeAt[ev.stage] + STAGE_DWELL_MS - Date.now();
              if (wait > 0) await sleep(wait);
              if (unmounted) return;
              setStages((prev) => ({ ...prev, [ev.stage]: "complete" }));
            }
          } else if (!navigated.current) {
            navigated.current = true;
            await sleep(500); // the existing settle beat before Results
            if (!unmounted) nav(`/jobs/${jobId}/results`);
          }
        }
      } finally {
        draining = false;
      }
    };

    const stop = streamJobEvents(jobId, {
      onStage: (e) => {
        if (e.status === "failed") {
          // Error states bypass the dwell queue — surface immediately.
          setStages((prev) => ({ ...prev, [e.stage]: "failed" }));
          return;
        }
        queue.push({ kind: "stage", stage: e.stage, status: e.status });
        void drain();
      },
      onProgress: (e) => setProgress({ matched: e.matched, total: e.total }),
      onComplete: (e) => {
        if (e.result_id) {
          queue.push({ kind: "complete" });
          void drain();
        }
      },
      onError: (e) => setError(e.message), // bypasses the queue
    });
    return () => {
      unmounted = true;
      stop();
    };
  }, [jobId, nav]);

  if (!jobId) return <div className="p-12 text-muted-foreground">Job not found.</div>;

  const orderedStages = STAGE_DEFS.map((d) => ({ ...d, state: stages[d.key] }));

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow text-muted-foreground">JOB · {jobId}</div>
          <h1 className="text-2xl mt-1">Working through your BOM</h1>
          <div className="mt-2 mono text-xs text-muted-foreground">
            {meta?.file ?? "…"} · live pipeline
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="live-dot" /> {error ? "Error" : "Processing"}
        </span>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Stage strip — driven by real SSE events */}
      <div className="mt-10 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          {orderedStages.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <StageCard label={s.label} state={s.state} idx={i} stageKey={s.key} />
              {i < orderedStages.length - 1 && (
                <div
                  className={`h-px flex-1 mx-2 ${s.state === "complete" ? "bg-success" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live progress (real ranker progress events) */}
      <div className="mt-8 rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Live progress</h2>
          <span className="mono text-xs text-muted-foreground">
            {progress ? `${progress.matched} / ${progress.total} lines ranked` : "starting…"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Real engine: parse → 4-lane retrieve → Sonnet rank → calibrated confidence → enrich →
          assemble. Results open automatically when complete.
        </p>
      </div>
    </div>
  );
}

function StageCard({
  label,
  state,
  idx,
  stageKey,
}: {
  label: string;
  state: StageState;
  idx: number;
  stageKey: string;
}) {
  const stateClasses =
    state === "active"
      ? "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]"
      : state === "complete"
        ? "border-border"
        : state === "failed"
          ? "border-danger"
          : "border-border opacity-60";
  return (
    <div
      data-stage={stageKey}
      data-state={state}
      className={`rounded-md border bg-card px-3 py-2.5 w-[120px] ${stateClasses}`}
    >
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] text-muted-foreground">0{idx + 1}</span>
        {state === "active" && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
        {state === "complete" && <Check className="h-3 w-3 text-success" />}
        {state === "failed" && <X className="h-3 w-3 text-danger" />}
      </div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </div>
  );
}

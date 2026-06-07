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

    const stop = streamJobEvents(jobId, {
      onStage: (e) =>
        setStages((prev) => ({
          ...prev,
          [e.stage]:
            e.status === "completed" ? "complete" : e.status === "failed" ? "failed" : "active",
        })),
      onProgress: (e) => setProgress({ matched: e.matched, total: e.total }),
      onComplete: (e) => {
        if (e.result_id && !navigated.current) {
          navigated.current = true;
          setTimeout(() => nav(`/jobs/${jobId}/results`), 500);
        }
      },
      onError: (e) => setError(e.message),
    });
    return stop;
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
              <StageCard label={s.label} state={s.state} idx={i} />
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

function StageCard({ label, state, idx }: { label: string; state: StageState; idx: number }) {
  const stateClasses =
    state === "active"
      ? "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]"
      : state === "complete"
        ? "border-border"
        : state === "failed"
          ? "border-danger"
          : "border-border opacity-60";
  return (
    <div className={`rounded-md border bg-card px-3 py-2.5 w-[120px] ${stateClasses}`}>
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

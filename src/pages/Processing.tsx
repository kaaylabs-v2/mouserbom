import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getJob } from "@/lib/mockApi";
import { seedRows } from "@/lib/mockData";
import { Check, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Processing() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(jobId ? getJob(jobId) : undefined);

  useEffect(() => {
    if (!jobId) return;
    const id = setInterval(() => {
      const j = getJob(jobId);
      setJob(j);
      if (j?.status === "complete") {
        clearInterval(id);
        setTimeout(() => nav(`/jobs/${jobId}/results`), 600);
      }
    }, 250);
    return () => clearInterval(id);
  }, [jobId, nav]);

  if (!job) {
    return <div className="p-12 text-muted-foreground">Job not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow text-muted-foreground">JOB · {job.id}</div>
          <h1 className="text-2xl mt-1">Working through your BOM</h1>
          <div className="mt-2 mono text-xs text-muted-foreground">
            {job.file} · {job.lines} lines · started {new Date(job.startedAt).toLocaleTimeString()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="live-dot" /> Processing
          </span>
          <button className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted focus-ring">Cancel</button>
        </div>
      </div>

      {/* Stage strip */}
      <div className="mt-10 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          {job.stages.map((s, i) => (
            <div key={s.name} className="flex items-center flex-1 last:flex-none">
              <StageCard stage={s} idx={i} />
              {i < job.stages.length - 1 && (
                <div className={`h-px flex-1 mx-2 ${job.stages[i].state === "complete" ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div className="mt-8 rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Live preview</h2>
          <span className="mono text-xs text-muted-foreground">{job.rowsRevealed} / {job.lines} matched</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left font-medium px-5 py-2.5 w-10">#</th>
              <th className="text-left font-medium px-3 py-2.5">Recommended part</th>
              <th className="text-left font-medium px-3 py-2.5">Manufacturer</th>
              <th className="text-left font-medium px-3 py-2.5">Pkg</th>
              <th className="text-right font-medium px-3 py-2.5">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {seedRows.slice(0, 10).map((r, i) => {
              const revealed = i < job.rowsRevealed;
              return (
                <tr key={r.n} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5 mono text-xs text-muted-foreground">{r.n.toString().padStart(2, "0")}</td>
                  <td className="px-3 py-2.5">
                    <AnimatePresence mode="wait">
                      {revealed ? (
                        <motion.span key="v" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          className="mono text-sm">{r.sku}</motion.span>
                      ) : <span className="skeleton block h-3 w-40" />}
                    </AnimatePresence>
                  </td>
                  <td className="px-3 py-2.5">{revealed ? r.mfr : <span className="skeleton block h-3 w-32" />}</td>
                  <td className="px-3 py-2.5">{revealed ? <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{r.pkg}</span> : <span className="skeleton block h-3 w-16" />}</td>
                  <td className="px-3 py-2.5 text-right">
                    {revealed ? <span className="mono text-xs">{Math.round(r.confidence * 100)}%</span> : <span className="skeleton inline-block h-3 w-10" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageCard({ stage, idx }: { stage: { name: string; state: string; ms?: number }; idx: number }) {
  const stateClasses =
    stage.state === "active" ? "border-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]" :
    stage.state === "complete" ? "border-border" :
    stage.state === "failed" ? "border-danger" : "border-border opacity-60";
  return (
    <div className={`rounded-md border bg-card px-3 py-2.5 w-[120px] ${stateClasses}`}>
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] text-muted-foreground">0{idx + 1}</span>
        {stage.state === "active" && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
        {stage.state === "complete" && <Check className="h-3 w-3 text-success" />}
        {stage.state === "failed" && <X className="h-3 w-3 text-danger" />}
      </div>
      <div className="mt-1 text-xs font-medium">{stage.name}</div>
      <div className="mt-0.5 mono text-[10px] text-muted-foreground h-3">
        {stage.state === "complete" && stage.ms ? `${(stage.ms / 1000).toFixed(1)}s` : ""}
      </div>
    </div>
  );
}

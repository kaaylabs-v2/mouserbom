import { useNavigate } from "react-router-dom";
import { useCallback, useRef, useState } from "react";
import { Upload, ArrowRight, BookOpen, Plug, FileSpreadsheet } from "lucide-react";
import { createJob, listJobs } from "@/lib/mockApi";
import { StatusPill } from "@/components/atoms";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const spark = (n: number, seed: number) =>
  Array.from({ length: n }, (_, i) => ({ v: Math.sin(i / 1.5 + seed) * 8 + 24 + (i % 3) * 2 + seed * 1.5 }));

const stats = [
  { label: "BOMs processed (30d)", value: "1,284", data: spark(14, 0.3) },
  { label: "Avg. match accuracy", value: "94.2%", data: spark(14, 0.7) },
  { label: "Avg. processing time", value: "11.4s", data: spark(14, 1.1) },
];

const fmtRel = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
};

export default function Workspace() {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const submit = useCallback((file: { name: string; size: number }) => {
    const job = createJob(file);
    nav(`/jobs/${job.id}`);
  }, [nav]);

  return (
    <div className="min-h-full">
      {/* HERO */}
      <section className="bg-navy text-navy-foreground">
        <div className="max-w-7xl mx-auto px-8 pt-16 pb-32">
          <div className="eyebrow text-accent-cyan/90 mb-4">BOM INTELLIGENCE ENGINE</div>
          <h1 className="text-5xl leading-[1.05] max-w-3xl">Turn any BOM into a purchase-ready decision.</h1>
          <p className="mt-5 text-lg text-navy-foreground/70 max-w-2xl">
            Drop your file. We parse, match, rank alternatives, and score every line in under 30 seconds.
          </p>
        </div>
      </section>

      {/* UPLOAD CARD overlapping */}
      <div className="max-w-7xl mx-auto px-8 -mt-20">
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setOver(false);
            const f = e.dataTransfer.files?.[0];
            submit({ name: f?.name ?? "bom.csv", size: f?.size ?? 0 });
          }}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer bg-card rounded-lg border ${over ? "border-accent ring-4 ring-accent-cyan/15" : "border-border"} border-dashed [border-width:1.5px] p-10 text-center transition-colors`}
        >
          <input ref={inputRef} type="file" hidden accept=".csv,.xlsx,.xls,.pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) submit({ name: f.name, size: f.size }); }} />
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent mb-4">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-base font-medium">Drag a BOM here · or click to upload</div>
          <div className="mt-1 text-sm text-muted-foreground mono">Excel · CSV · PDF · up to 25MB</div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); submit({ name: "pasted-rows.csv", size: 1 }); }}
            className="mt-4 text-sm text-accent hover:underline focus-ring rounded">
            or paste rows directly
          </button>
        </motion.div>
      </div>

      {/* MAIN GRID */}
      <section className="max-w-7xl mx-auto px-8 mt-12 grid grid-cols-3 gap-6">
        {/* Recent jobs */}
        <div className="col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-base font-semibold">Recent jobs</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Last 14 days</p>
            </div>
            <button className="text-xs mono text-muted-foreground hover:text-foreground">VIEW ALL →</button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium px-5 py-2.5">Job</th>
                <th className="text-left font-medium px-3 py-2.5">File</th>
                <th className="text-right font-medium px-3 py-2.5">Lines</th>
                <th className="text-left font-medium px-3 py-2.5">Status</th>
                <th className="text-right font-medium px-3 py-2.5">Match rate</th>
                <th className="text-right font-medium px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map(j => (
                <tr key={j.id}
                    onClick={() => nav(j.status === "processing" ? `/jobs/${j.id}` : `/jobs/${j.id}/results`)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-surface-muted">
                  <td className="px-5 py-3 mono text-xs text-muted-foreground">{j.id}</td>
                  <td className="px-3 py-3 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    {j.file}
                  </td>
                  <td className="px-3 py-3 mono text-right tabular-nums">{j.lines}</td>
                  <td className="px-3 py-3"><StatusPill status={j.status} /></td>
                  <td className="px-3 py-3 mono text-right tabular-nums">{j.matchRate != null ? (j.matchRate * 100).toFixed(0) + "%" : "—"}</td>
                  <td className="px-3 py-3 mono text-right text-xs text-muted-foreground">{fmtRel(j.submitted)}</td>
                  <td className="px-3 py-3 text-muted-foreground"><ArrowRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="text-xs eyebrow text-muted-foreground">AT A GLANCE</div>
          {stats.map((s, i) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 mono text-2xl font-semibold tabular-nums">{s.value}</div>
              <div className="h-10 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.data}>
                    <Line type="monotone" dataKey="v" stroke={i === 1 ? "hsl(var(--accent-cyan))" : "hsl(var(--accent))"} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* QUICKSTART */}
      <section className="max-w-7xl mx-auto px-8 mt-12 mb-16 grid grid-cols-3 gap-6">
        <button
          onClick={() => submit({ name: "sample-mainboard.xlsx", size: 1 })}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-accent transition-colors focus-ring">
          <FileSpreadsheet className="h-4 w-4 text-accent" />
          <div className="mt-3 font-medium">Try a sample BOM</div>
          <p className="text-sm text-muted-foreground mt-1">Loads a 24-line demo and walks through processing.</p>
        </button>
        <a className="rounded-lg border border-border bg-card p-5 hover:border-accent transition-colors focus-ring block">
          <BookOpen className="h-4 w-4 text-accent" />
          <div className="mt-3 font-medium">Read the spec</div>
          <p className="text-sm text-muted-foreground mt-1">How matching, ranking, and confidence are calculated.</p>
        </a>
        <div className="rounded-lg border border-border bg-card p-5 opacity-70">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <div className="mt-3 font-medium">Connect Mouser catalog</div>
          <p className="text-sm text-muted-foreground mt-1">Coming soon — live pricing and stock integration.</p>
        </div>
      </section>
    </div>
  );
}

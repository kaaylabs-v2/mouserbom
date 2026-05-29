import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  ShieldCheck,
  Gauge,
  FileSearch,
  Activity,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import data from "@/config/architecture-data.json";

type StageType = "llm" | "ml" | "det";

const typeMeta: Record<
  StageType,
  { label: string; chip: string; ring: string; dot: string; soft: string }
> = {
  llm: {
    label: "LLM",
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
    ring: "border-amber-400/60",
    dot: "bg-amber-500",
    soft: "bg-amber-50 dark:bg-amber-500/5",
  },
  ml: {
    label: "ML",
    chip: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/40",
    ring: "border-violet-400/60",
    dot: "bg-violet-500",
    soft: "bg-violet-50 dark:bg-violet-500/5",
  },
  det: {
    label: "Deterministic",
    chip: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40",
    ring: "border-blue-400/60",
    dot: "bg-blue-500",
    soft: "bg-blue-50 dark:bg-blue-500/5",
  },
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "walkthrough", label: "Walkthrough" },
  { id: "trust", label: "Trust" },
  { id: "catalog", label: "Catalog" },
  { id: "eval", label: "Eval" },
  { id: "deploy", label: "Deploy" },
];

const deployColumns = [
  {
    id: "org",
    header: "Your Organization",
    tone: "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30",
    cards: [
      { title: "Employees & Applications", sub: "Managed devices · MFA · SSO" },
      { title: "Corporate Data", sub: "Documents · Code · Customer records" },
      { title: "Identity & Access (Entra ID)", sub: "Azure AD · RBAC · Conditional Access" },
      { title: "Network Controls", sub: "Private links only · CASB · No public internet" },
      { title: "Audit & Compliance", sub: "GDPR · HIPAA · SOC2 · ISO 27001" },
      { title: "Data Loss Prevention (DLP)", sub: "Blocks PII · Prevents exfiltration · Watermarking", accent: "rose" as const },
      { title: "Key Guarantee", sub: "Claude NEVER trained on your data\nYou own the encryption keys.", accent: "emerald" as const },
    ],
  },
  {
    id: "protect",
    header: "Protection Layer",
    tone: "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20",
    cards: [
      { title: "Content & Safety Guardrails", sub: "Topic rules · Jailbreak detection · Blocklists" },
      { title: "Encryption", sub: "TLS 1.3 in transit · AES-256 at rest · BYOK" },
      { title: "Regional Compliance", sub: "EU stays in EU · HIPAA regions · Azure Policy" },
      { title: "WAF & API Management", sub: "OWASP rules · Prompt-injection block · Rate limits" },
      { title: "Vulnerability Management", sub: "Pen tests · SBOM · 24hr patch SLA" },
      { title: "AI Governance", sub: "Inference-only · Microsoft & Anthropic contract" },
      { title: "Prompt Firewall + Output Scanner", sub: "PII scrub · Sensitivity labeling · Anomaly alerts" },
    ],
    cardBorder: "border-emerald-500/60",
  },
  {
    id: "azure",
    header: "Azure Cloud — Private VNet",
    tone: "border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20",
    cards: [
      { title: "Claude on Azure Marketplace", sub: "Anthropic-listed · Stateless · Region-locked" },
      { title: "Private Connectivity", sub: "Azure Private Endpoint · No public internet · NSG: 443" },
      { title: "Identity (Entra ID)", sub: "Managed Identity · Azure RBAC · MFA enforced" },
      { title: "Encryption (Key Vault)", sub: "Customer Managed Keys · Microsoft has zero access" },
      { title: "Audit Trail (Azure Monitor)", sub: "Every AI call logged · Log Analytics · Sentinel SIEM" },
      { title: "Purview + Defender", sub: "Data classification · Sensitivity labels · Threats" },
      { title: "Azure Policy", sub: "Deny non-approved regions · Deny public endpoints" },
    ],
    cardBorder: "border-blue-500/60",
  },
  {
    id: "blocked",
    header: "Blocked — Not Permitted",
    tone: "border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20",
    cards: [
      { title: "Direct Anthropic API", sub: "api.anthropic.com · BLOCKED at firewall" },
      { title: "OpenAI / ChatGPT", sub: "api.openai.com · chat.openai.com · BLOCKED" },
      { title: "Data Exfiltration", sub: "USB · Email · Clipboard · BLOCKED" },
      { title: "Model Training on Corp Data", sub: "No fine-tuning · Inference-only · BLOCKED" },
      { title: "Cross-Region Data Movement", sub: "EU data stays in EU · Azure Policy · BLOCKED" },
      { title: "Unapproved AI Tools", sub: "Consumer Claude.ai · Personal API keys · BLOCKED" },
      { title: "Public Endpoints & Shadow IT", sub: "No public IPs · CASB enforced · All access monitored" },
    ],
    cardBorder: "border-rose-500/60 bg-rose-50/60 dark:bg-rose-950/30",
    blocked: true,
  },
];

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow text-muted-foreground">{children}</div>;
}

function StageChip({ s, onClick }: { s: any; onClick?: () => void }) {
  const m = typeMeta[s.type as StageType];
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 rounded-full border-2 px-3 py-1.5 ${m.ring} ${m.soft} transition-all hover:-translate-y-0.5 hover:shadow-sm focus-ring`}
      title={s.name}
    >
      <span className={`mono text-[10px] text-muted-foreground`}>0{s.n}</span>
      <span className="font-semibold text-xs">{s.name}</span>
      <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.chip}`}>{m.label}</span>
    </button>
  );
}

function StageCard({ s }: { s: any }) {
  const [open, setOpen] = useState(false);
  const m = typeMeta[s.type as StageType];
  return (
    <div id={`stage-${s.id}`} className={`rounded-xl border ${m.ring} bg-card overflow-hidden`}>
      <div className="grid grid-cols-12 gap-0">
        {/* Left: number + name */}
        <div className={`col-span-12 md:col-span-2 p-6 ${m.soft} border-r border-border flex md:flex-col items-baseline md:items-start gap-3`}>
          <div className="mono text-5xl font-bold leading-none text-foreground/90">{String(s.n).padStart(2, "0")}</div>
          <div>
            <div className="text-xl font-semibold tracking-tight">{s.name}</div>
            <div className="mt-1 inline-flex items-center gap-2">
              <span className={`mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.chip}`}>{m.label}</span>
            </div>
          </div>
        </div>

        {/* Middle: description + bullets */}
        <div className="col-span-12 md:col-span-7 p-6 border-r border-border">
          <p className="text-sm leading-relaxed text-foreground/90">{s.summary}</p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {s.bullets.map((b: string) => (
              <li key={b} className="text-xs flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${m.dot}`} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: live status */}
        <div className="col-span-12 md:col-span-3 p-6 bg-surface-muted/40">
          <div className="flex items-center justify-between">
            <Eyebrow>Status</Eyebrow>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {s.status}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Accuracy</span><span className="mono">{s.accuracy}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Latency</span><span className="mono">{s.latency}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cost</span><span className="mono">{s.cost}</span></div>
          </div>
        </div>
      </div>

      {/* Expandable */}
      <div className="border-t border-border">
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-6 py-3 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-surface-muted/60 transition-colors focus-ring"
        >
          <span className="inline-flex items-center gap-2"><FileSearch className="h-3.5 w-3.5" /> Show example transformation</span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {open && (
          <div className="px-6 pb-6 pt-2">
            {s.id === "retrieve" ? <RetrieveExpanded s={s} /> :
             s.id === "rank" ? <RankExpanded /> :
             s.id === "confidence" ? <ConfidenceExpanded /> :
             <ExampleIO input={s.example.input} output={s.example.output} />}
          </div>
        )}
      </div>
    </div>
  );
}

function ExampleIO({ input, output }: { input: string; output: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-md border border-border bg-surface-muted/50 p-3">
        <Eyebrow>Input</Eyebrow>
        <div className="mono text-xs mt-2 break-words">{input}</div>
      </div>
      <div className="rounded-md border border-border bg-surface-muted/50 p-3">
        <Eyebrow>Output</Eyebrow>
        <div className="mono text-xs mt-2 break-words">{output}</div>
      </div>
    </div>
  );
}

function RetrieveExpanded({ s }: { s: any }) {
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {s.lanes.map((lane: any) => (
          <div key={lane.name} className="rounded-md border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/5 p-3">
            <div className="text-xs font-semibold">{lane.name}</div>
            <div className="mono text-[10px] text-muted-foreground mt-0.5">{lane.tech}</div>
            <ul className="mt-2 space-y-1">
              {lane.candidates.map((c: string) => (
                <li key={c} className="mono text-[10px] truncate">{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex justify-center my-3 text-muted-foreground">
        <ChevronDown className="h-5 w-5" />
      </div>
      <div className="rounded-md border border-violet-400 dark:border-violet-500/60 bg-violet-100 dark:bg-violet-500/10 p-3 text-center">
        <div className="text-xs font-semibold">Reciprocal Rank Fusion</div>
        <div className="mono text-[10px] text-muted-foreground">combines lane scores into a single ranked list</div>
      </div>
      <div className="flex justify-center my-3 text-muted-foreground">
        <ChevronDown className="h-5 w-5" />
      </div>
      <div className="rounded-md border border-border bg-surface-muted p-3">
        <Eyebrow>Final candidate set (passed to ranker)</Eyebrow>
        <div className="mono text-xs mt-2">5 SKUs, all from real Mouser catalog</div>
      </div>
    </div>
  );
}

function RankExpanded() {
  const candidates = [
    "652-ERJ-3EKF4701V",
    "652-ERJ-PA3F4701V",
    "71-CRCW06034K70FKEA",
    "603-RC0603FR-074K7L",
    "652-ERJ-3GEYJ472V",
  ];
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5 p-3">
        <Eyebrow>Input to Claude Sonnet</Eyebrow>
        <div className="mt-2 space-y-1">
          {candidates.map((c, i) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <span className="mono text-[10px] text-muted-foreground w-5">{i}</span>
              <span className="mono">{c}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5 p-3">
        <Eyebrow>Output (constrained JSON)</Eyebrow>
        <pre className="mono text-xs mt-2 whitespace-pre-wrap">{`{
  "index": 0,
  "rationale": "Exact MPN match"
}`}</pre>
        <div className="mt-3 rounded border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/5 p-2 text-[11px] text-rose-800 dark:text-rose-300">
          <ShieldCheck className="inline h-3.5 w-3.5 mr-1" />
          If the model returns a SKU not in the candidate list, the response is rejected — not auto-corrected. Inventing parts is structurally impossible.
        </div>
      </div>
    </div>
  );
}

function ConfidenceExpanded() {
  return (
    <div>
      <div className="relative h-8 rounded-md overflow-hidden border border-border">
        <div className="absolute inset-0 flex">
          <div className="h-full" style={{ width: "40%", background: "hsl(0 0% 70% / 0.25)" }} />
          <div className="h-full" style={{ width: "20%", background: "hsl(0 84% 60% / 0.25)" }} />
          <div className="h-full" style={{ width: "25%", background: "hsl(38 92% 50% / 0.30)" }} />
          <div className="h-full" style={{ width: "15%", background: "hsl(160 84% 39% / 0.30)" }} />
        </div>
        <div className="absolute inset-0 flex items-center text-[10px] mono text-foreground/80">
          <span className="w-[40%] text-center">no_match &lt;0.4</span>
          <span className="w-[20%] text-center">Low</span>
          <span className="w-[25%] text-center">Medium</span>
          <span className="w-[15%] text-center">High ≥0.85</span>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-surface-muted/50 p-3">
          <Eyebrow>Signals (input to calibrator)</Eyebrow>
          <ul className="mt-2 space-y-1 text-xs">
            <li className="flex justify-between"><span>top1 − top2 margin</span><span className="mono">0.32</span></li>
            <li className="flex justify-between"><span>attribute match %</span><span className="mono">100%</span></li>
            <li className="flex justify-between"><span>lexical score</span><span className="mono">1.00</span></li>
            <li className="flex justify-between"><span>semantic score</span><span className="mono">0.91</span></li>
            <li className="flex justify-between"><span>policy penalty</span><span className="mono">0.00</span></li>
          </ul>
        </div>
        <div className="rounded-md border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/5 p-3">
          <Eyebrow>Calibrated output</Eyebrow>
          <div className="mt-2 mono text-2xl font-bold">0.94</div>
          <div className="text-xs text-muted-foreground">Band: <span className="font-semibold text-emerald-700 dark:text-emerald-400">High</span></div>
          <div className="mt-2 text-[11px] text-muted-foreground italic">Calibrator is trained on historical accept/reject signals. The LLM is never asked to grade itself.</div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Walkthrough ──────────── */

function WalkStep({ n, title, children, type }: { n: number; title: string; children: React.ReactNode; type: StageType }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const m = typeMeta[type];
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${shown ? "opacity-100 translate-y-0" : "opacity-30 translate-y-4"}`}
    >
      <div className={`rounded-xl border ${m.ring} bg-card overflow-hidden`}>
        <div className={`px-5 py-3 ${m.soft} border-b border-border flex items-center gap-3`}>
          <span className="mono text-xs text-muted-foreground">STAGE {n}</span>
          <div className="font-semibold text-sm">{title}</div>
          <span className={`ml-auto mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.chip}`}>{m.label}</span>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const STAMP_TOOLTIPS: Record<string, string> = {
  pipeline_version: "The overall version of the BOM Intelligence Engine that processed this line. Bumps when major architectural changes ship.",
  parser_version: "The version of the parsing step that read this row. Bumps when parsing rules or the parser's AI prompt change.",
  parser_route: "How this line was parsed — 'rules' means deterministic patterns handled it, 'llm_fallback' means the AI handled it, 'mixed' means both contributed.",
  normalizer_version: "The version of the canonicalization step that translated shorthand into Mouser's official terminology. Bumps when the alias index or normalization rules change.",
  ranker_version: "The version of the AI ranking step that picked the top recommendation. Bumps when the prompt, the model, or the scoring logic changes.",
  prompt_version: "The exact version of the prompt the AI ranker received. Locked so any ranking decision can be replayed identically.",
  calibrator_version: "The version of the confidence calibrator. 'hand_locked_v1' is a stop-gap calibrator that will be replaced by a trained one once richer ground-truth labels arrive.",
  catalog_snapshot_id: "A fingerprint of which version of the Mouser catalog was indexed when this line was processed. Rotates when the catalog re-embeds, so 'before' and 'after' catalog changes can be cleanly separated in the audit trail.",
};

function StampLabel({ k }: { k: string }) {
  const tip = STAMP_TOOLTIPS[k];
  if (!tip) return <>{k}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {k}
          <Info className="h-3 w-3 text-muted-foreground/60" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px]">
        <p className="text-xs leading-relaxed">{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-xs py-1 border-b border-dashed border-border last:border-0">
      <span className="mono text-muted-foreground w-44 shrink-0"><StampLabel k={k} /></span>
      <span className="mono break-all">{v}</span>
    </div>
  );
}

function Walkthrough() {
  const w = data.walkthrough;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-300 dark:border-border bg-slate-50 dark:bg-surface-muted px-4 py-3">
        <Eyebrow>Input line (intentionally messy — no MPN, multi-manufacturer)</Eyebrow>
        <div className="mono text-sm mt-2">{w.rawLine}</div>
      </div>

      <WalkStep n={1} title="Ingest — raw cells parsed from the file" type="det">
        <div className="flex flex-wrap gap-2">
          {w.raw.map((c, i) => (
            <span key={i} className={`mono text-xs px-2 py-1 rounded border ${c === "" ? "border-dashed border-amber-400 dark:border-amber-500/50 bg-amber-50/60 dark:bg-amber-500/5 text-muted-foreground italic" : "border-border bg-surface-muted"}`}>
              {c === "" ? "∅ empty (MPN)" : c}
            </span>
          ))}
        </div>
      </WalkStep>

      <WalkStep n={2} title="Parse — structured fields extracted" type="llm">
        {Object.entries(w.parsed).map(([k, v]) => (
          <KV key={k} k={k} v={JSON.stringify(v)} />
        ))}
        {w.parsedNote && (
          <div className="mt-3 text-[11px] text-amber-700 dark:text-amber-300 italic">{w.parsedNote}</div>
        )}
      </WalkStep>

      <WalkStep n={3} title="Normalize — manufacturer + values canonicalized" type="det">
        <KV k="manufacturer" v={JSON.stringify(w.normalized.manufacturer)} />
        <KV k="value" v={`"${w.normalized.value}"`} />
        <KV k="normalizer_version" v={`"${w.normalized.normalizer_version}"`} />
        <div className="mt-3 text-[11px] text-muted-foreground italic">{w.normalized.note}</div>
      </WalkStep>

      <WalkStep n={4} title="Retrieve — four lanes converge to a candidate set" type="ml">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {w.retrieved.lanes.map((lane) => {
            const empty = lane.candidates.length === 0;
            return (
              <div key={lane.name} className={`rounded-md border p-2 ${empty ? "border-dashed border-slate-300 dark:border-border bg-slate-50/50 dark:bg-surface-muted/30" : "border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/5"}`}>
                <div className="text-[11px] font-semibold flex justify-between"><span>{lane.name}</span><span className="mono text-muted-foreground">{lane.score.toFixed(2)}</span></div>
                {empty ? (
                  <div className="mt-2 text-[10px] italic text-muted-foreground">— {lane.note} —</div>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {lane.candidates.map((c) => <li key={c} className="mono text-[10px] truncate">{c}</li>)}
                  </ul>
                )}
                {!empty && lane.note && (
                  <div className="mt-1 text-[10px] italic text-muted-foreground">{lane.note}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-center my-2 text-muted-foreground"><ChevronDown className="h-4 w-4" /></div>
        <div className="rounded-md border border-border bg-surface-muted p-3">
          <Eyebrow>Fused candidate set (RRF)</Eyebrow>
          <ul className="mt-2 space-y-1">
            {w.retrieved.fused.map((f, i) => (
              <li key={f.sku} className="flex justify-between text-xs">
                <span className="mono"><span className="text-muted-foreground mr-2">{i}</span>{f.sku}</span>
                <span className="mono text-muted-foreground">rrf {f.rrf.toFixed(3)}</span>
              </li>
            ))}
          </ul>
          {w.retrieved.fusedNote && (
            <div className="mt-3 text-[11px] italic text-muted-foreground">{w.retrieved.fusedNote}</div>
          )}
        </div>
      </WalkStep>

      <WalkStep n={5} title="Rank — Claude Sonnet returns an INDEX, not a SKU" type="llm">
        <div className="rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/5 p-3">
          <Eyebrow>Ranker response</Eyebrow>
          <pre className="mono text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(w.ranked.response, null, 2)}</pre>
        </div>
        <div className="mt-3 rounded-md border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> <span className="text-xs font-semibold">Resolved top-1 SKU</span></div>
          <div className="mono text-sm mt-1">{w.ranked.top1_sku}</div>
        </div>
      </WalkStep>

      <WalkStep n={6} title="Confidence — calibrated probability + signals" type="ml">
        <div className="flex items-baseline gap-3">
          <div className="mono text-3xl font-bold">{w.confidence.score}</div>
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">{w.confidence.band}</span>
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-x-6">
          {Object.entries(w.confidence.signals).map(([k, v]) => (
            <KV key={k} k={k} v={String(v)} />
          ))}
        </div>
        {w.confidence.note && (
          <div className="mt-3 text-[11px] italic text-muted-foreground">{w.confidence.note}</div>
        )}
      </WalkStep>

      <WalkStep n={7} title="Enrich — live catalog data attached" type="det">
        {Object.entries(w.enriched).map(([k, v]) => <KV key={k} k={k} v={String(v)} />)}
      </WalkStep>

      <WalkStep n={8} title="Assemble — final recommendation + audit trail" type="det">
        <div className="rounded-md border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-500/5 p-3">
          <Eyebrow>Top-1</Eyebrow>
          <div className="flex justify-between mt-1">
            <div>
              <div className="mono text-sm">{w.assembled.top1.sku}</div>
              {w.assembled.top1.manufacturer && <div className="text-[11px] text-muted-foreground">{w.assembled.top1.manufacturer}</div>}
            </div>
            <div className="text-right">
              <span className="mono text-xs">conf {w.assembled.top1.confidence}</span>
              {w.assembled.top1.band && <div className="text-[10px] text-amber-700 dark:text-amber-300">{w.assembled.top1.band}</div>}
            </div>
          </div>
          {w.assembled.top1.rationale && (
            <div className="mt-2 text-[11px] italic text-muted-foreground">{w.assembled.top1.rationale}</div>
          )}
        </div>
        <div className="mt-3">
          <Eyebrow>Alternates</Eyebrow>
          <ul className="mt-2 space-y-1">
            {w.assembled.alternates.map((a) => (
              <li key={a.sku} className="flex justify-between items-start text-xs gap-3">
                <div className="min-w-0">
                  <span className="mono">{a.sku}</span>
                  {a.manufacturer && <span className="text-muted-foreground"> · {a.manufacturer}</span>}
                  {a.label && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${a.label === "Strong alternative" ? "bg-emerald-500 text-white" : "bg-amber-500 text-amber-950"}`}>{a.label}</span>
                  )}
                </div>
                <span className="mono text-muted-foreground whitespace-nowrap">conf {a.confidence}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4">
          <Eyebrow>Audit trail</Eyebrow>
          <p className="text-xs italic text-muted-foreground mt-2">
            Every recommendation carries a version stamp for every step that produced it. Hover any field for a plain-language explanation.
          </p>
          <div className="mt-2 grid sm:grid-cols-2 gap-x-6">
            {Object.entries(w.assembled.audit).map(([k, v]) => <KV key={k} k={k} v={String(v)} />)}
          </div>
        </div>
      </WalkStep>
    </div>
  );
}

/* ──────────── Trust ──────────── */

function TrustCallout({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: any }) {
  return (
    <div className="rounded-xl border-2 border-rose-300 dark:border-rose-500/40 bg-rose-50/60 dark:bg-rose-500/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        <div className="eyebrow text-rose-700 dark:text-rose-300">Guardrail</div>
      </div>
      <div className="font-semibold mb-2">{title}</div>
      <div className="text-sm text-foreground/85 space-y-3">{children}</div>
    </div>
  );
}

/* ──────────── Eval ──────────── */

function AccuracyBars() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="space-y-3">
      {data.eval.fieldAccuracy.map((f) => (
        <div key={f.field}>
          <div className="flex justify-between text-xs mb-1"><span>{f.field}</span><span className="mono">{f.value}%</span></div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: shown ? `${f.value}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommitChart() {
  const max = 100;
  const pts = data.eval.commitProgression;
  const w = 280, h = 100, pad = 20;
  const stepX = (w - pad * 2) / (pts.length - 1);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${h - pad - (p.accuracy / max) * (h - pad * 2)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="hsl(var(--border))" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
        {pts.map((p, i) => (
          <g key={p.commit}>
            <circle cx={pad + i * stepX} cy={h - pad - (p.accuracy / max) * (h - pad * 2)} r="3" fill="hsl(var(--primary))" />
            <text x={pad + i * stepX} y={h - 4} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" className="mono">{p.commit}</text>
            <text x={pad + i * stepX} y={h - pad - (p.accuracy / max) * (h - pad * 2) - 6} textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" className="mono">{p.accuracy}%</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ──────────── Page ──────────── */

export default function Architecture() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 h-12 flex items-center gap-6">
          <span className="eyebrow text-muted-foreground">Architecture</span>
          <div className="hidden md:flex items-center gap-5 text-xs">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
                {s.label}
              </a>
            ))}
          </div>
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            Back to demo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-6 py-16">
        {/* Section 1 — Hero */}
        <section id="overview" className="scroll-mt-20">
          <Eyebrow>System architecture</Eyebrow>
          <h1 className="text-4xl md:text-5xl mt-3 max-w-4xl leading-[1.1]">
            From a customer's messy BOM to confidence-scored Mouser SKUs — with the AI structurally barred from inventing parts.
          </h1>

          <div className="grid md:grid-cols-3 gap-4 mt-10">
            {[
              { v: data.metrics.extractionAccuracy, l: data.metrics.extractionLabel },
              { v: data.metrics.costPerBom, l: data.metrics.costLabel },
              { v: "Audit", l: data.metrics.auditLabel },
            ].map((m) => (
              <div key={m.l} className="rounded-xl border border-border bg-card p-5">
                <div className="mono text-3xl font-bold">{m.v}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Eyebrow>The pipeline at a glance</Eyebrow>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {data.stages.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <a href={`#stage-${s.id}`}><StageChip s={s} /></a>
                  {i < data.stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2 — Pipeline */}
        <section id="pipeline" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 02 · The pipeline</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">Eight stages, each with one job</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            LLMs do the linguistic work. ML calibrates confidence. Deterministic code handles everything that must be exact. Open any stage to see the example transformation.
          </p>
          <div className="space-y-4">
            {data.stages.map((s) => <StageCard key={s.id} s={s} />)}
          </div>
        </section>

        {/* Section 3 — Walkthrough */}
        <section id="walkthrough" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 03 · Follow this line through the pipeline</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">One messy line, eight transformations</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            Scroll down. The line transforms in place — each stage's output reveals as it scrolls into view.
          </p>
          <Walkthrough />
        </section>

        {/* Section 4 — Trust */}
        <section id="trust" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 04 · Trust mechanisms</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">The three guardrails</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            These are not features — they are structural constraints on what the system can do.
          </p>
          <div className="grid lg:grid-cols-3 gap-4">
            <TrustCallout title="No SKU hallucinations" icon={ShieldCheck}>
              <p>The ranker (Stage 5) receives a fixed candidate list and must return an index, not a free-form SKU. Off-list responses are rejected, not auto-corrected.</p>
              <div className="rounded border border-border bg-background p-2 mono text-[11px]">
                <div className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 text-rose-600" /> {`{"sku":"FAKE-123-NOPB"}`}</div>
                <div className="text-muted-foreground ml-5">→ rejected · fallback to lexical scoring with reduced confidence</div>
              </div>
            </TrustCallout>
            <TrustCallout title="Calibrated confidence" icon={Gauge}>
              <p>A score of 0.9 means we expect to be right roughly 9 times out of 10 on lines like this — measured against ground truth, not LLM self-opinion.</p>
              <div className="space-y-1 text-[11px] mono">
                <div className="flex items-center gap-2"><span className="h-2 w-12 rounded bg-emerald-500" /> ≥ 0.85 · High</div>
                <div className="flex items-center gap-2"><span className="h-2 w-12 rounded bg-amber-500" /> 0.6–0.85 · Medium</div>
                <div className="flex items-center gap-2"><span className="h-2 w-12 rounded bg-rose-500" /> &lt; 0.6 · Low</div>
                <div className="flex items-center gap-2"><span className="h-2 w-12 rounded bg-muted-foreground/40" /> &lt; 0.4 · no_match</div>
              </div>
            </TrustCallout>
            <TrustCallout title="Every line is audit-traced" icon={FileSearch}>
              <p>When something goes wrong six months from now, we replay the exact path that produced the answer.</p>
              <p className="text-xs italic text-muted-foreground mt-2 mb-1">
                Every recommendation carries a version stamp for every step that produced it. Hover any field for a plain-language explanation.
              </p>
              <div className="rounded border border-border bg-background p-2 mono text-[10px] space-y-0.5">
                {Object.entries(data.walkthrough.assembled.audit).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground"><StampLabel k={k} /></span><span>{String(v)}</span></div>
                ))}
              </div>
            </TrustCallout>
          </div>
        </section>

        {/* Section 5 — Catalog */}
        <section id="catalog" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 05 · Catalog substrate</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">The Mouser Catalog as a data layer</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            Not a labeled box — a real, indexed table feeding retrieval and enrichment.
          </p>
          <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <div className="eyebrow text-emerald-800 dark:text-emerald-300">Mouser Catalog</div>
              <div className="ml-auto mono text-xs text-muted-foreground">{data.catalog.rowCount}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <Eyebrow>Schema</Eyebrow>
                <div className="mt-2 grid grid-cols-2 gap-x-6">
                  {data.catalog.fields.map(([f, t]) => (
                    <div key={f} className="flex justify-between text-xs py-1 border-b border-dashed border-border">
                      <span className="mono">{f}</span>
                      <span className="mono text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Eyebrow>Embedding pipeline</Eyebrow>
                <div className="mt-2 rounded border border-border bg-background p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">model</span><span className="mono">{data.catalog.embedding.model}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">dim</span><span className="mono">{data.catalog.embedding.dim}</span></div>
                  <div className="text-muted-foreground mt-2">source-text</div>
                  <div className="mono text-[11px] break-words">{data.catalog.embedding.sourceText}</div>
                  <div className="text-muted-foreground mt-2">idempotency</div>
                  <div className="mono text-[11px]">{data.catalog.embedding.idempotency}</div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <a href="#stage-retrieve" className="rounded-md border border-emerald-300 dark:border-emerald-500/40 bg-background/60 p-3 flex items-center gap-2 text-xs hover:shadow-sm transition-shadow">
                <ArrowRight className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <span><span className="font-semibold">→ Stage 4 · Retrieve</span> · candidates + embeddings</span>
              </a>
              <a href="#stage-enrich" className="rounded-md border border-emerald-300 dark:border-emerald-500/40 bg-background/60 p-3 flex items-center gap-2 text-xs hover:shadow-sm transition-shadow">
                <ArrowRight className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <span><span className="font-semibold">→ Stage 7 · Enrich</span> · pricing + lifecycle</span>
              </a>
            </div>
          </div>
        </section>

        {/* Section 6 — Eval */}
        <section id="eval" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 06 · How we know it's working</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">The eval harness</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            Every change reports its delta. Nothing ships without a number behind it.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-primary" /><Eyebrow>Per-field accuracy</Eyebrow></div>
              <AccuracyBars />
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Eyebrow>Accuracy progression (last 3 commits)</Eyebrow>
              <div className="mt-3"><CommitChart /></div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Eyebrow>Operational metrics</Eyebrow>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Latency</span><span className="mono">{data.eval.ops.latency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cost / BOM</span><span className="mono">{data.eval.ops.cost}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tests</span><span className="mono">{data.eval.ops.tests}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <Eyebrow>Synthetic labels (v0)</Eyebrow>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{data.eval.labels}</p>
            </div>
          </div>
        </section>

        {/* Section 7 — Deployment & Security */}
        <section id="deploy" className="scroll-mt-20 mt-32">
          <Eyebrow>Section 07 · Where it lives</Eyebrow>
          <h2 className="text-3xl mt-2 mb-2">Where it lives: deployment & security</h2>
          <p className="text-muted-foreground max-w-2xl mb-8">
            How a BOM upload flows through corporate controls into Claude on Azure, with explicit deny-list.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">
            {deployColumns.map((col, ci) => (
              <div key={col.id} className={`rounded-xl border ${col.tone} p-4`}>
                <div className="mb-3">
                  <div className="text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground">
                    {col.header}
                  </div>
                </div>
                <div className="space-y-2">
                  {col.cards.map((c, i) => {
                    const accent =
                      (c as any).accent === "rose"
                        ? "border-rose-500/70"
                        : (c as any).accent === "emerald"
                        ? "border-emerald-500/70"
                        : col.cardBorder || "border-border";
                    return (
                      <div
                        key={i}
                        className={`relative rounded-lg border ${accent} bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm`}
                      >
                        {col.blocked && (
                          <XCircle className="h-3.5 w-3.5 text-rose-500 absolute top-2 right-2" />
                        )}
                        <div className="text-xs font-medium pr-5">{c.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line leading-relaxed">
                          {c.sub}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Flow labels */}
          <div className="hidden lg:grid grid-cols-4 gap-4 mt-3 text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground">
            <div className="text-right pr-2 flex items-center justify-end gap-1">
              Filtered Request <ArrowRight className="h-3 w-3" />
            </div>
            <div className="text-right pr-2 flex items-center justify-end gap-1">
              Encrypted Private Endpoint <ArrowRight className="h-3 w-3" />
            </div>
            <div className="text-right pr-2 flex items-center justify-end gap-1 text-rose-500">
              <XCircle className="h-3 w-3" /> No flow permitted
            </div>
            <div />
          </div>
          <div className="hidden lg:grid grid-cols-4 gap-4 mt-1 text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground">
            <div />
            <div className="text-left pl-2 flex items-center gap-1">
              <ArrowRight className="h-3 w-3 rotate-180" /> Scanned Response
            </div>
            <div />
            <div />
          </div>

          {/* Open questions */}
          <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-5">
            <div className="text-amber-900 dark:text-amber-200">
              <Eyebrow>Open questions</Eyebrow>
              <h3 className="text-sm font-semibold mt-2 mb-3">
                Three deployment-time questions still being resolved with infrastructure team.
              </h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <p>
                  <span className="font-semibold">OpenAI dependency in the synthetic labeler.</span>{" "}
                  The BIE's eval-label generation uses GPT-5 + Sonnet 4.6 two-model agreement.
                  Recommended resolution: run label generation offline as a build-time process
                  outside the production VNet — labels flow in as a static dataset, OpenAI is never
                  called at runtime.
                </p>
                <p>
                  <span className="font-semibold">Direct Anthropic API endpoint.</span> Current code
                  points at api.anthropic.com. Switching to Claude on Azure Marketplace endpoint:
                  half-day of work, identical models, must land before B5 ranker ships.
                </p>
                <p>
                  <span className="font-semibold">Voyage AI for semantic embeddings.</span> Three
                  resolution paths under discussion: private-endpoint extension of Column 3,
                  runtime-call elimination via aggressive caching, or replacement with an
                  Azure-allowed embedding model.
                </p>
              </div>
            </div>
          </div>

          {/* Application tier */}
          <div className="mt-4 rounded-xl border border-border bg-slate-100 dark:bg-slate-900/40 p-5">
            <Eyebrow>Coming additions: the BIE application tier</Eyebrow>
            <p className="text-xs leading-relaxed mt-2 text-muted-foreground">
              This diagram covers AI consumption — how Claude is called from inside the corporate
              VNet. The BIE application itself (FastAPI backend, Postgres + pgvector database,
              React frontend, eval harness) requires a parallel application tier inside the VNet
              using Azure App Service or AKS, Azure Database for PostgreSQL with pgvector enabled,
              and Azure Static Web Apps. To be added in a follow-up infrastructure design pass.
            </p>
          </div>

          <p className="mt-4 text-[11px] italic text-muted-foreground">
            Diagram source: Mouser infrastructure team proposal · Last updated: {today}.
          </p>
        </section>

        <footer className="mt-24 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">Mouser BOM Intelligence Engine · POC build · Updated: {today}</p>
        </footer>
      </div>
    </div>
  );
}

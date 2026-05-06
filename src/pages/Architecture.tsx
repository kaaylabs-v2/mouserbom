import { useState } from "react";
import { ChevronRight, Database, Activity, ShieldCheck, Gauge } from "lucide-react";

type StageType = "llm" | "ml" | "det";

type Stage = {
  id: string;
  n: number;
  name: string;
  type: StageType;
  job: string;
  status: string;
  accuracy: string;
  tech: string[];
  examples: { input: string; output: string; note?: string }[];
};

const stages: Stage[] = [
  {
    id: "ingest", n: 1, name: "Ingest", type: "det",
    job: "Accept any BOM file (XLSX, CSV, PDF). Detect format, sheets, and encoding. Stream into a uniform row buffer.",
    status: "Stable", accuracy: "100% format coverage on test corpus (n=842)",
    tech: ["SheetJS", "pdfplumber", "MIME sniffing", "Deterministic file router"],
    examples: [
      { input: "messy_bom_v3.xlsx · 3 sheets · merged headers", output: "Uniform row buffer · 412 rows · sheet=BOM_R3", note: "Auto-selects the densest sheet" },
      { input: "altium_export.csv · UTF-16 LE · semicolon-delimited", output: "212 rows · encoding=utf-16le · delim=';'", note: "Encoding sniffed from BOM marker" },
      { input: "ProductionBOM.pdf · 4-page table, scanned", output: "187 rows extracted · OCR fallback applied to p.3", note: "Falls back to OCR per-page when text layer is missing" },
    ],
  },
  {
    id: "parse", n: 2, name: "Parse", type: "llm",
    job: "Identify which columns are MPN, manufacturer, description, qty, reference designator — even when headers are missing, multilingual, or merged.",
    status: "LLM-assisted",
    accuracy: "98.4% column-role F1 across 1,200 customer headers",
    tech: ["Anthropic Claude Haiku", "Few-shot column-role prompts", "Rules-based fallback extractor"],
    examples: [
      { input: "['Part #', 'Vendor', 'Desc.', 'Qty/board', 'RefDes']", output: "{ mpn:'Part #', mfr:'Vendor', desc:'Desc.', qty:'Qty/board', ref:'RefDes' }" },
      { input: "['Artikelnummer', 'Hersteller', 'Bezeichnung', 'Menge']  (German)", output: "{ mpn:'Artikelnummer', mfr:'Hersteller', desc:'Bezeichnung', qty:'Menge' }", note: "Multilingual header recognition" },
      { input: "Headerless rows beginning 'C1,C2 | 100nF 0603 X7R | 14'", output: "{ ref:'C1,C2', desc:'100nF 0603 X7R', qty:14 }  · header inferred", note: "No header row → role inference from value patterns" },
    ],
  },
  {
    id: "normalize", n: 3, name: "Normalize", type: "det",
    job: "Canonicalize values: strip packaging suffixes, unify units, fold whitespace, expand abbreviations (10K → 10 kΩ).",
    status: "Stable", accuracy: "99.7% canonicalization match vs gold set",
    tech: ["Regex grammars", "Unit conversion tables", "Manufacturer alias map"],
    examples: [
      { input: "'TI  LM358DR2G   (SOIC-8)'", output: "mfr=Texas Instruments · mpn=LM358DR2G · pkg=SOIC-8", note: "Alias 'TI' → 'Texas Instruments'" },
      { input: "'10K 0805 1%'", output: "value=10 kΩ · pkg=0805 · tol=±1%" },
      { input: "'4u7 25V X5R 0402'", output: "cap=4.7 µF · v=25 V · diel=X5R · pkg=0402", note: "European decimal notation expanded" },
      { input: "'CAP CER 0.1UF 50V X7R 0603 -RC'", output: "cap=0.1 µF · v=50 V · diel=X7R · pkg=0603", note: "Packaging suffix '-RC' stripped" },
    ],
  },
  {
    id: "retrieve", n: 4, name: "Retrieve", type: "ml",
    job: "Pull a constrained candidate set of real Mouser SKUs for each line using hybrid lexical + vector search over the catalog.",
    status: "Production",
    accuracy: "Recall@20 = 99.1% · median 14 candidates/line",
    tech: ["BM25 (OpenSearch)", "bge-large-en embeddings", "pgvector ANN", "Catalog-bounded retrieval"],
    examples: [
      { input: "LM358DR2G · op-amp · SOIC-8", output: "[595-LM358DR2G, 595-LM358ADR, 863-NCV20034DR2G, … 17 more]", note: "Lexical hit on exact MPN dominates" },
      { input: "'10 kΩ 0805 ±1% thick film'", output: "[652-CR0805FX-1002ELF, 71-CRCW080510K0FKEA, 603-RC0805FR-0710KL, … 22 more]", note: "Vector recall — no exact MPN given" },
      { input: "'0.1µF 50V X7R 0603'", output: "[81-GRM188R71H104KA93D, 810-CGA3E2X7R1H104K, 77-VJ0603Y104KXJPBC, … 28 more]", note: "Generic part — broad candidate set" },
    ],
  },
  {
    id: "rank", n: 5, name: "Rank", type: "llm",
    job: "Score each candidate against the normalized line. The LLM may only choose from the retrieved set — it cannot invent a SKU.",
    status: "LLM-assisted",
    accuracy: "Top-1 match accuracy 96.2% on labeled set (n=4,318)",
    tech: ["Claude Haiku (constrained JSON)", "Attribute-match feature vector", "Catalog-id whitelist enforcement"],
    examples: [
      { input: "20 candidates · target: LM358DR2G / SOIC-8 / TI", output: "595-LM358DR2G · 0.94 · 'exact MPN + pkg + mfr'" },
      { input: "25 candidates · target: 10 kΩ 0805 ±1% (no MPN)", output: "71-CRCW080510K0FKEA · 0.81 · 'attr-exact, preferred mfr'", note: "Tie-breaks on substitution policy" },
      { input: "Hallucination attempt: LLM proposes '595-FAKE-999'", output: "REJECTED · whitelist violation · falls back to next valid candidate", note: "Catalog-id guard prevents hallucinated SKUs" },
    ],
  },
  {
    id: "confidence", n: 6, name: "Confidence", type: "ml",
    job: "Assign a calibrated probability that the top pick is correct. This is a separate model trained on historical accept/reject signals — not the LLM grading itself.",
    status: "Calibrated",
    accuracy: "ECE = 0.024 · Brier = 0.061",
    tech: ["Gradient-boosted classifier", "Isotonic calibration", "Features: rank gap, attribute coverage, retrieval score"],
    examples: [
      { input: "score=0.94 · rank-gap=0.31 · attr-coverage=1.00", output: "P=0.97 → HIGH", note: "Auto-acceptable for most policies" },
      { input: "score=0.71 · rank-gap=0.04 · attr-coverage=0.83", output: "P=0.58 → MEDIUM", note: "Close runner-up triggers review" },
      { input: "score=0.42 · rank-gap=0.01 · attr-coverage=0.50", output: "P=0.19 → LOW · flag for human", note: "Routed to procurement engineer queue" },
    ],
  },
  {
    id: "enrich", n: 7, name: "Enrich", type: "det",
    job: "Attach live Mouser catalog data: price tiers, stock, lifecycle, datasheet URLs, RoHS, lead time.",
    status: "Stable", accuracy: "Catalog SLA: <1.2s p95 per line",
    tech: ["Mouser Catalog API", "Per-region pricing tables", "Lifecycle service"],
    examples: [
      { input: "595-LM358DR2G", output: "$0.42 @1k · 18,420 in stock · Active · RoHS · DS link" },
      { input: "863-NCV20034DR2G  (NRND)", output: "$0.61 @1k · 2,140 in stock · NRND · last-buy 2026-09-30", note: "Lifecycle flag surfaces to UI" },
      { input: "71-CRCW080510K0FKEA · qty=4,500", output: "tier price = $0.0048 · 312k stock · 6-wk lead on backorder" },
    ],
  },
  {
    id: "assemble", n: 8, name: "Assemble", type: "det",
    job: "Compose the final results payload: row decisions, alternates, audit trail, export shapes (CSV / XLSX / JSON / API).",
    status: "Stable", accuracy: "Schema-validated · 0 export defects in last 30d",
    tech: ["Zod schemas", "Deterministic serializer", "Audit log writer"],
    examples: [
      { input: "412 per-line decisions + signals", output: "results.json · results.xlsx · audit.jsonl" },
      { input: "Same job, API caller", output: "POST /v1/jobs/{id}/results → 200 · 412 rows · ETag set", note: "Idempotent · cached by job hash" },
      { input: "Row with rejected pick + accepted alternate", output: "audit.jsonl appended: {action:'replace', from:'…', to:'…', user:'ac@mouser'}" },
    ],
  },
];

const typeMeta: Record<StageType, { label: string; ring: string; chip: string; dot: string }> = {
  llm: { label: "LLM", ring: "border-orange-500/40 hover:border-orange-500", chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30", dot: "bg-orange-500" },
  ml:  { label: "ML",  ring: "border-purple-500/40 hover:border-purple-500", chip: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30", dot: "bg-purple-500" },
  det: { label: "Deterministic", ring: "border-sky-500/40 hover:border-sky-500", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30", dot: "bg-sky-500" },
};

export default function Architecture() {
  const [activeId, setActiveId] = useState<string>("rank");
  const active = stages.find(s => s.id === activeId)!;

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <div className="mb-8">
        <div className="eyebrow text-muted-foreground mb-2">SYSTEM ARCHITECTURE</div>
        <h1 className="text-3xl mb-2">How the BOM Intelligence Engine works</h1>
        <p className="text-muted-foreground max-w-3xl">An eight-stage pipeline. LLMs do the linguistic work. ML calibrates confidence. Deterministic code handles everything that must be exact. Click any stage to inspect it.</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-6 text-sm">
        {(["llm","ml","det"] as StageType[]).map(t => (
          <div key={t} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${typeMeta[t].dot}`} />
            <span className="text-muted-foreground">{typeMeta[t].label}</span>
          </div>
        ))}
      </div>

      {/* Catalog substrate */}
      <div className="mb-3">
        <div className="rounded-lg border border-border bg-surface-muted px-5 py-3 flex items-center gap-3">
          <Database className="h-4 w-4 text-accent-cyan" />
          <div className="eyebrow text-muted-foreground">MOUSER CATALOG · DATA SUBSTRATE</div>
          <div className="text-sm text-muted-foreground">~1.2M active SKUs · pricing · stock · lifecycle · datasheets</div>
          <div className="ml-auto mono text-xs text-muted-foreground">feeds → Stage 4 · Stage 7</div>
        </div>
        <div className="flex justify-around px-8 pt-1 pointer-events-none" aria-hidden>
          <div className="h-5 border-l-2 border-dotted border-accent-cyan/50" style={{ marginLeft: "30%" }} />
          <div className="h-5 border-l-2 border-dotted border-accent-cyan/50" style={{ marginLeft: "20%" }} />
        </div>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-8 gap-2 mb-3">
        {stages.map((s, i) => {
          const meta = typeMeta[s.type];
          const isActive = s.id === activeId;
          return (
            <div key={s.id} className="relative">
              <button
                onClick={() => setActiveId(s.id)}
                className={`w-full text-left rounded-lg border-2 bg-card px-3 py-3 transition-all focus-ring ${meta.ring} ${isActive ? "ring-2 ring-ring shadow-md -translate-y-0.5" : "hover:-translate-y-0.5 hover:shadow-sm"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="mono text-[10px] text-muted-foreground">STAGE {s.n}</span>
                  <span className={`mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
                </div>
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.job.split(".")[0]}.</div>
              </button>
              {i < stages.length - 1 && (
                <ChevronRight className="hidden xl:block absolute -right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 z-10" />
              )}
            </div>
          );
        })}
      </div>

      {/* Guardrail callouts */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <div className="eyebrow text-emerald-700 dark:text-emerald-400">GUARDRAIL · STAGES 4–5</div>
          </div>
          <div className="font-semibold text-sm mb-1">No SKU hallucinations</div>
          <p className="text-sm text-muted-foreground">Stage 4 retrieves a bounded candidate set from the real Mouser catalog. Stage 5's LLM must select from that set — its output is validated against the catalog-id whitelist before it leaves the ranker. A SKU that does not exist cannot be returned.</p>
        </div>
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <div className="eyebrow text-purple-700 dark:text-purple-400">GUARDRAIL · STAGE 6</div>
          </div>
          <div className="font-semibold text-sm mb-1">Calibrated confidence</div>
          <p className="text-sm text-muted-foreground">Confidence is produced by a separate calibrated classifier trained on historical accept/reject signals. The LLM is never asked to grade itself. A 0.95 score means 95% of similarly-scored picks were accepted by procurement engineers.</p>
        </div>
      </div>

      {/* Eval harness */}
      <div className="rounded-lg border border-border bg-surface-muted px-5 py-3 mb-8 flex items-center gap-3">
        <Activity className="h-4 w-4 text-accent" />
        <div className="eyebrow text-muted-foreground">EVAL HARNESS · MEASUREMENT LAYER</div>
        <div className="text-sm text-muted-foreground">Observes every stage · gold-set regression · per-stage precision/recall · drift alerts</div>
        <div className="ml-auto mono text-xs text-muted-foreground">last run: 6h ago · 0 regressions</div>
      </div>

      {/* Detail panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <span className="mono text-xs text-muted-foreground">STAGE {active.n}</span>
          <h2 className="text-xl font-semibold">{active.name}</h2>
          <span className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${typeMeta[active.type].chip}`}>{typeMeta[active.type].label}</span>
          <span className="ml-auto text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> {active.status}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-0">
          <div className="p-6 border-r border-border">
            <div className="eyebrow text-muted-foreground mb-2">JOB</div>
            <p className="text-sm leading-relaxed">{active.job}</p>
            <div className="eyebrow text-muted-foreground mt-5 mb-2">CURRENT STATUS</div>
            <p className="mono text-sm">{active.accuracy}</p>
          </div>
          <div className="p-6 border-r border-border">
            <div className="eyebrow text-muted-foreground mb-3">KEY TECHNOLOGIES</div>
            <ul className="space-y-2">
              {active.tech.map(t => (
                <li key={t} className="text-sm flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${typeMeta[active.type].dot}`} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6">
            <div className="eyebrow text-muted-foreground mb-3">EXAMPLE TRANSFORMATIONS</div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {active.examples.map((ex, i) => (
                <div key={i} className="rounded-md border border-border bg-surface-muted/50 p-3">
                  <div className="mono text-[10px] uppercase text-muted-foreground mb-1">Input</div>
                  <div className="mono text-xs break-words">{ex.input}</div>
                  <div className="flex justify-center text-muted-foreground my-1"><ChevronRight className="h-3.5 w-3.5 rotate-90" /></div>
                  <div className="mono text-[10px] uppercase text-muted-foreground mb-1">Output</div>
                  <div className="mono text-xs break-words">{ex.output}</div>
                  {ex.note && <div className="mt-2 text-[11px] text-muted-foreground italic">{ex.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

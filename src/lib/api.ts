// Real backend API client (replaces the mock data layer for live wiring).
//
// Talks to the BIE FastAPI backend (api-contract.md). Base URL + bearer
// token come from gitignored env (.env.local): VITE_API_BASE,
// VITE_API_TOKEN. Client-side token exposure is acceptable for
// LOCAL-ONLY dev (POC shared credential); hosting gets real auth later.
//
// Stage A scope: the READ path — render an existing completed job's
// real results. Shapes are mapped from the backend's BomResult /
// RecommendedLine into the frontend's ResultRow (see mockData.ts).

import type { AltRow, Lifecycle, ResultRow } from "./mockData";

const API_BASE: string = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/v1";
const API_TOKEN: string = import.meta.env.VITE_API_TOKEN ?? "";

function authHeaders(): HeadersInit {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify((await res.json()) as unknown);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`GET ${path} → ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

// --- backend shapes (minimal, only what the read path consumes) -----------

interface BackendJobMetrics {
  // From GET /jobs[/{id}].metrics; persisted with exclude_none, so any field
  // may be absent. stage_cost_usd feeds the Results run-metrics chip;
  // line_count/matched_count feed the dashboard (both mapped null-safely).
  duration_ms?: number | null;
  stage_cost_usd?: Record<string, number> | null;
  line_count?: number | null;
  matched_count?: number | null;
}
interface BackendJob {
  id: string;
  status: string;
  result_id: string | null;
  source: { filename?: string; content_type?: string };
  created_at?: string;
  metrics?: BackendJobMetrics | null;
}

interface BackendMoney {
  amount: number;
  currency: string;
}
interface BackendSku {
  sku: string;
  mpn: string;
  manufacturer: string;
  description: string;
  package?: string | null;
  lifecycle?: string | null;
  price: { unit: BackendMoney };
  availability: { in_stock: number };
  attribute_match_pct?: number;
  rationale?: string;
}
interface BackendLine {
  outcome: string;
  best_fit: BackendSku | null;
  alternatives: BackendSku[];
  confidence: { score: number };
  rationale: string;
  input_summary: {
    mpn?: string | null;
    manufacturer?: string | null;
    description?: string | null;
    quantity: number;
  };
  diagnostics?: { reasons: string[]; next_actions: string[] } | null;
}
interface BackendBomResult {
  id: string;
  lines: BackendLine[];
}

// --- mappers --------------------------------------------------------------

// Pass the backend lifecycle through verbatim; anything unrecognized (incl.
// null/missing) reads as "unknown" — NOT "active". Silently relabeling a
// non-active part as active misrepresents its real status.
export function toLifecycle(raw: string | null | undefined): Lifecycle {
  switch (raw) {
    case "active":
    case "nrnd":
    case "ltb":
    case "obsolete":
    case "preview":
      return raw;
    default:
      return "unknown";
  }
}

function toAltRow(s: BackendSku): AltRow {
  return {
    sku: s.sku,
    mpn: s.mpn,
    mfr: s.manufacturer,
    pkg: s.package ?? "—",
    price: s.price?.unit?.amount ?? 0,
    stock: s.availability?.in_stock ?? 0,
    match: { pkg: true, tol: true, voltage: true },
    rationale: s.rationale ?? "",
    attribute_match_pct: s.attribute_match_pct,
  };
}

function lineToResultRow(line: BackendLine, index: number): ResultRow {
  const bf = line.best_fit;
  const isMatch = line.outcome === "match" && bf !== null;
  const inp = line.input_summary;
  return {
    n: index + 1,
    // FE convention: no_match rows carry sku === "no_match".
    sku: isMatch ? bf!.sku : "no_match",
    mpn: (isMatch ? bf!.mpn : inp.mpn) ?? "",
    mfr: (isMatch ? bf!.manufacturer : inp.manufacturer) ?? "—",
    pkg: (isMatch ? bf!.package : null) ?? "—",
    price: isMatch ? (bf!.price?.unit?.amount ?? null) : null,
    stock: isMatch ? (bf!.availability?.in_stock ?? null) : null,
    alts: line.alternatives?.length ?? 0,
    confidence: line.confidence?.score ?? 0,
    rationale: line.rationale ?? "",
    lifecycle: toLifecycle(isMatch ? bf!.lifecycle : null),
    qty: inp.quantity ?? 0,
    alternatives: (line.alternatives ?? []).map(toAltRow),
    raw: {
      description: inp.description ?? "",
      mpn: inp.mpn ?? "",
      qty: inp.quantity ?? 0,
    },
    input: {
      mpn: inp.mpn ?? undefined,
      description: inp.description ?? undefined,
    },
    diagnostics: line.diagnostics
      ? { reasons: line.diagnostics.reasons, next_actions: line.diagnostics.next_actions }
      : undefined,
  };
}

// --- public read-path API (async; mirrors mockApi names) ------------------

export async function fetchJobMeta(
  jobId: string
): Promise<{
  file: string;
  lines: number;
  createdAt: string;
  // Run metrics, both already present on GET /jobs/{id} — NO backend change.
  // durationMs: server-side pipeline elapsed (not wall-clock incl. queue).
  // costUsd: SUM of the per-stage LLM cost (an ESTIMATE, not a billed figure).
  durationMs: number | null;
  costUsd: number | null;
}> {
  const job = await getJSON<BackendJob>(`/jobs/${encodeURIComponent(jobId)}`);
  let lines = 0;
  if (job.result_id) {
    const result = await getJSON<BackendBomResult>(`/results/${encodeURIComponent(job.result_id)}`);
    lines = result.lines.length;
  }
  // Two distinct "absent" cases the UI must tell apart:
  //  - duration_ms ABSENT → job hasn't finished (metrics not stamped yet) →
  //    durationMs null → header shows NO run-metrics chip.
  //  - duration_ms PRESENT but stage_cost_usd ABSENT → job finished and NO LLM
  //    ran (e.g. every line resolved via the exact-MPN tiebreak, Sonnet
  //    skipped) → costUsd 0, a TRUE number meaning "no AI calls", not missing.
  const m = job.metrics;
  const durationMs = typeof m?.duration_ms === "number" ? m.duration_ms : null;
  const costUsd =
    durationMs === null
      ? null
      : Object.values(m?.stage_cost_usd ?? {}).reduce((sum, c) => sum + c, 0);
  return {
    file: job.source?.filename ?? "bom",
    lines,
    createdAt: job.created_at ?? "",
    durationMs,
    costUsd,
  };
}

export async function fetchResults(jobId: string): Promise<ResultRow[]> {
  const job = await getJSON<BackendJob>(`/jobs/${encodeURIComponent(jobId)}`);
  if (!job.result_id) return [];
  const result = await getJSON<BackendBomResult>(
    `/results/${encodeURIComponent(job.result_id)}`
  );
  return result.lines.map(lineToResultRow);
}

// --- Workspace dashboard: recent jobs (GET /v1/jobs) -----------------------

// The FE status vocabulary (StatusPill). The backend's four mid-pipeline
// statuses (parsing/matching/ranking/enriching) all collapse to "processing".
export type RecentJobStatus = "queued" | "processing" | "complete" | "partial" | "failed";

export interface RecentJob {
  id: string;
  file: string;
  lines: number | null;
  status: RecentJobStatus;
  matchRate: number | null;
  submitted: string; // ISO
  durationMs: number | null;
}

function toRecentStatus(raw: string): RecentJobStatus {
  switch (raw) {
    case "queued":
    case "complete":
    case "failed":
    case "partial":
      return raw;
    case "parsing":
    case "matching":
    case "ranking":
    case "enriching":
      return "processing";
    default:
      // Out-of-contract value — StatusPill's own fallback is "queued"; match it.
      return "queued";
  }
}

// limit=200 is the backend's Query max (app/api/jobs.py list_jobs). The 30d
// stat therefore still caps at 200 jobs; the real fix is a backend /v1/stats
// endpoint — decision pending with Santosh.
export async function listRecentJobs(limit = 200): Promise<RecentJob[]> {
  const jobs = await getJSON<BackendJob[]>(`/jobs?limit=${limit}`);
  return jobs.map((j) => {
    const m = j.metrics ?? {};
    const lines = m.line_count ?? null;
    const matched = m.matched_count ?? null;
    return {
      id: j.id,
      file: j.source?.filename ?? "bom",
      lines,
      status: toRecentStatus(j.status),
      // Null-safe: either count absent (incl. failed jobs) → no rate, not NaN.
      matchRate: lines != null && lines > 0 && matched != null ? matched / lines : null,
      submitted: j.created_at ?? "",
      durationMs: m.duration_ms ?? null,
    };
  });
}

// --- Stage B: create job (multipart upload) -------------------------------

export async function createJob(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: authHeaders(), // do NOT set Content-Type — the browser sets the multipart boundary
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = JSON.stringify((await res.json()) as unknown);
    } catch {
      /* keep statusText */
    }
    throw new Error(`POST /jobs → ${res.status}: ${detail}`);
  }
  const ack = (await res.json()) as { job_id: string };
  return ack.job_id;
}

// --- Stage B: live job events via authed SSE ------------------------------
// EventSource can't send an Authorization header, so we consume the SSE
// stream with fetch + a ReadableStream reader and parse the frames.

export interface StageEvent {
  stage: string;
  status: "started" | "completed" | "failed";
}
export interface ProgressEvent {
  matched: number;
  total: number;
}
export interface CompleteEvent {
  job_id?: string;
  result_id?: string;
}

interface JobEventHandlers {
  onStage?: (e: StageEvent) => void;
  onProgress?: (e: ProgressEvent) => void;
  onComplete?: (e: CompleteEvent) => void;
  onError?: (e: { message: string }) => void;
}

export function streamJobEvents(jobId: string, handlers: JobEventHandlers): () => void {
  const ctrl = new AbortController();
  (async () => {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/events`, {
      headers: { ...authHeaders(), Accept: "text/event-stream" },
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        let type = "";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) type = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (type === "stage") handlers.onStage?.(parsed as StageEvent);
        else if (type === "progress") handlers.onProgress?.(parsed as ProgressEvent);
        else if (type === "complete") handlers.onComplete?.(parsed as CompleteEvent);
        else if (type === "error") handlers.onError?.(parsed as { message: string });
      }
    }
  })().catch((e: unknown) => {
    if (!ctrl.signal.aborted) handlers.onError?.({ message: String(e) });
  });
  return () => ctrl.abort();
}

// --- Stage C: download the server-rendered Mouser quote -------------------
// The download needs the bearer header, so a plain <a href> won't do — fetch
// the bytes and save via a blob URL. Replaces the client-side SheetJS
// re-derivation for xlsx/csv (single source of truth = the server layout).

export async function downloadMouserQuote(jobId: string, fmt: "xlsx" | "csv"): Promise<void> {
  const job = await getJSON<BackendJob>(`/jobs/${encodeURIComponent(jobId)}`);
  if (!job.result_id) throw new Error("job has no result yet");
  const res = await fetch(
    `${API_BASE}/results/${encodeURIComponent(job.result_id)}/export?format=${fmt}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`export → ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${job.result_id}.${fmt}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Catalog browse (GET /v1/catalog) -------------------------------------

export interface CatalogItem {
  sku: string;
  mpn: string;
  manufacturer: string;
  description: string;
  package: string | null;
  lifecycle: string;
  price: { amount: number; currency: string } | null;
  stock: number;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchCatalog(
  search: string,
  page: number,
  limit: number
): Promise<CatalogPage> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  params.set("page", String(page));
  params.set("limit", String(limit));
  return getJSON<CatalogPage>(`/catalog?${params.toString()}`);
}

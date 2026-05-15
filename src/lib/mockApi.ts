import { ResultRow, seedRows, sampleRows, stages, recentJobs as seedJobs, Job } from "./mockData";

type StageState = "pending" | "active" | "complete" | "failed";
export type JobState = {
  id: string;
  file: string;
  lines: number;
  startedAt: number;
  status: "queued" | "processing" | "complete" | "failed";
  stages: { name: string; state: StageState; ms?: number }[];
  rowsRevealed: number;
};

const STAGE_DURATIONS_MS = [600, 1100, 1300, 1800, 2200, 1400, 1600, 1000]; // ~11s

const jobs = new Map<string, JobState>();
const liveJobs: Job[] = [...seedJobs];

// Deterministic per-job results: subset/reorder seedRows by jobId hash.
const resultsCache = new Map<string, ResultRow[]>();
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function buildResultsForJob(id: string, lines?: number): ResultRow[] {
  if (resultsCache.has(id)) return resultsCache.get(id)!;
  const h = hash(id);
  const target = Math.min(seedRows.length, lines ?? (12 + (h % 13)));
  // rotate + shuffle deterministically
  const offset = h % seedRows.length;
  const rotated = [...seedRows.slice(offset), ...seedRows.slice(0, offset)];
  const picked = rotated.slice(0, target).map((r, i) => ({ ...r, n: i + 1 }));
  resultsCache.set(id, picked);
  return picked;
}
// pre-seed for headline jobs so their datasets feel distinct
seedJobs.forEach(j => buildResultsForJob(j.id, Math.min(seedRows.length, j.lines)));

export function listJobs(): Job[] {
  return liveJobs;
}

export function getJobMeta(id: string): { file: string; lines: number; createdAt: string } | undefined {
  const j = liveJobs.find(x => x.id === id);
  if (j) return { file: j.file, lines: j.lines, createdAt: j.submitted };
  const s = jobs.get(id);
  if (s) return { file: s.file, lines: s.lines, createdAt: new Date(s.startedAt).toISOString() };
  return undefined;
}

export function createJob(file: { name: string; size: number }): JobState {
  const id = "j_" + Math.random().toString(36).slice(2, 7);
  const isSample = /sample/i.test(file.name || "");
  const filename = file.name || "uploaded.csv";
  const lines = isSample ? sampleRows.length : seedRows.length;
  const state: JobState = {
    id,
    file: filename,
    lines,
    startedAt: Date.now(),
    status: "processing",
    stages: stages.map((name) => ({ name, state: "pending" as StageState })),
    rowsRevealed: 0,
  };
  jobs.set(id, state);
  // add to recent jobs feed
  liveJobs.unshift({
    id, file: state.file, lines, status: "processing", matchRate: null,
    submitted: new Date().toISOString(),
  });
  if (isSample) {
    resultsCache.set(id, sampleRows.map((r, i) => ({ ...r, n: i + 1 })));
  } else {
    buildResultsForJob(id, lines);
  }
  return state;
}

export function getJob(id: string): JobState | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  const elapsed = Date.now() - job.startedAt;
  let acc = 0;
  for (let i = 0; i < STAGE_DURATIONS_MS.length; i++) {
    const start = acc;
    acc += STAGE_DURATIONS_MS[i];
    if (elapsed >= acc) {
      job.stages[i].state = "complete";
      job.stages[i].ms = STAGE_DURATIONS_MS[i];
    } else if (elapsed >= start) {
      job.stages[i].state = "active";
    } else {
      job.stages[i].state = "pending";
    }
  }
  const rankStart = STAGE_DURATIONS_MS.slice(0, 4).reduce((a, b) => a + b, 0);
  const assembleEnd = acc;
  const revealWindow = assembleEnd - rankStart;
  const revealElapsed = Math.max(0, elapsed - rankStart);
  job.rowsRevealed = Math.min(job.lines, Math.floor((revealElapsed / revealWindow) * job.lines));
  if (elapsed >= acc) {
    job.status = "complete";
    job.rowsRevealed = job.lines;
    // promote in liveJobs
    const idx = liveJobs.findIndex(j => j.id === id);
    if (idx >= 0 && liveJobs[idx].status === "processing") {
      const rows = buildResultsForJob(id);
      const matchRate = rows.filter(r => r.confidence >= 0.85).length / rows.length;
      liveJobs[idx] = { ...liveJobs[idx], status: "complete", matchRate };
    }
  }
  return { ...job, stages: job.stages.map(s => ({ ...s })) };
}

export function getResults(id: string): ResultRow[] {
  return buildResultsForJob(id);
}

export async function submitFeedback(_payload: unknown) {
  await new Promise(r => setTimeout(r, 120));
  return { ok: true };
}

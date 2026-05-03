import { ResultRow, seedRows, stages } from "./mockData";

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

export function createJob(file: { name: string; size: number }): JobState {
  const id = "j_" + Math.random().toString(36).slice(2, 7);
  const lines = seedRows.length;
  const state: JobState = {
    id,
    file: file.name || "uploaded.csv",
    lines,
    startedAt: Date.now(),
    status: "processing",
    stages: stages.map((name) => ({ name, state: "pending" as StageState })),
    rowsRevealed: 0,
  };
  jobs.set(id, state);
  return state;
}

export function getJob(id: string): JobState | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  // Advance stages by elapsed time
  const elapsed = Date.now() - job.startedAt;
  let acc = 0;
  let activeIdx = -1;
  for (let i = 0; i < STAGE_DURATIONS_MS.length; i++) {
    const start = acc;
    acc += STAGE_DURATIONS_MS[i];
    if (elapsed >= acc) {
      job.stages[i].state = "complete";
      job.stages[i].ms = STAGE_DURATIONS_MS[i];
    } else if (elapsed >= start) {
      job.stages[i].state = "active";
      activeIdx = i;
    } else {
      job.stages[i].state = "pending";
    }
  }
  // After "Rank" stage (index 4) starts, reveal rows progressively
  const rankStart = STAGE_DURATIONS_MS.slice(0, 4).reduce((a, b) => a + b, 0);
  const assembleEnd = acc;
  const revealWindow = assembleEnd - rankStart;
  const revealElapsed = Math.max(0, elapsed - rankStart);
  job.rowsRevealed = Math.min(job.lines, Math.floor((revealElapsed / revealWindow) * job.lines));
  if (elapsed >= acc) {
    job.status = "complete";
    job.rowsRevealed = job.lines;
  }
  return { ...job, stages: job.stages.map(s => ({ ...s })) };
}

export function getResults(_id: string): ResultRow[] {
  return seedRows;
}

export async function submitFeedback(_payload: unknown) {
  await new Promise(r => setTimeout(r, 120));
  return { ok: true };
}

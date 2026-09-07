export const IDEA_LIMIT_ACTIVE = 10;

export type Priority = "high" | "medium" | "low";
export type FunnelStage =
  | "draft"
  | "queued"
  | "research"
  | "critical_evaluation"
  | "decision"
  | "mvp_in_progress"
  | "mvp_ready"
  | "archived";
export type ExecutionStatus = "running" | "paused" | "error" | "waiting_for_data";

export interface IdeaRow {
  id: string;
  title: string;
  source_transcript: string | null;
  source_kind: "text" | "voice";
  structured_idea: unknown;
  problem: string | null;
  audience: string | null;
  value: string | null;
  constraints: unknown;
  assumptions: unknown;
  priority: Priority;
  funnel_stage: FunnelStage;
  execution_status: ExecutionStatus;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export function titleFromTranscript(transcript: string): string {
  const firstSentence = transcript.trim().split(/[.!?…\n]/)[0] ?? "";
  const clipped =
    firstSentence.length > 119 ? `${firstSentence.slice(0, 119)}…` : firstSentence;
  return clipped || "Без названия";
}

export async function countActiveIdeas(sql: ReturnType<typeof postgres>): Promise<number> {
  const rows = await sql`
    select count(*) as n from ideas where funnel_stage != 'archived'`;
  return Number(rows[0].n);
}

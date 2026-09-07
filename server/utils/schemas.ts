// Централизованные Zod-схемы проекта (TZ §2, §3, §8).
// Единый источник правды: типы выводятся из схем (z.infer), не дублируются вручную.

import { z } from 'zod'

// ─── Constants ───────────────────────────────────────────────────────────────

export const IDEA_LIMIT_ACTIVE = 10

// ─── Route params ────────────────────────────────────────────────────────────

export const UuidParamSchema = z.object({
  id: z.string().uuid('Некорректный UUID'),
})

// ─── Enums ───────────────────────────────────────────────────────────────────

export const PrioritySchema = z.enum(['high', 'medium', 'low'], {
  errorMap: () => ({ message: 'Приоритет должен быть high, medium или low' }),
})
export type Priority = z.infer<typeof PrioritySchema>

export const SourceKindSchema = z.enum(['text', 'voice'])

export const FunnelStageSchema = z.enum([
  'draft',
  'queued',
  'research',
  'critical_evaluation',
  'decision',
  'mvp_in_progress',
  'mvp_ready',
  'archived',
])
export type FunnelStage = z.infer<typeof FunnelStageSchema>

export const ExecutionStatusSchema = z.enum(['running', 'paused', 'error', 'waiting_for_data'])
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

export const JobStatusSchema = z.enum(['queued', 'running', 'paused', 'done', 'cancelled', 'failed'])
export type JobStatus = z.infer<typeof JobStatusSchema>

// ─── Idea ────────────────────────────────────────────────────────────────────

export const IdeaCreateSchema = z.object({
  transcript: z.string().trim().min(1, 'Текст идеи пуст'),
  source_kind: SourceKindSchema.default('text'),
  priority: PrioritySchema.default('medium'),
})

export const IdeaRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  source_transcript: z.string().nullable(),
  source_kind: SourceKindSchema,
  structured_idea: z.unknown().nullable(),
  problem: z.string().nullable(),
  audience: z.string().nullable(),
  value: z.string().nullable(),
  constraints: z.unknown().nullable(),
  assumptions: z.unknown().nullable(),
  priority: PrioritySchema,
  funnel_stage: FunnelStageSchema,
  execution_status: ExecutionStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  version: z.number().int().nonnegative(),
})
export type IdeaRow = z.infer<typeof IdeaRowSchema>

// ─── Job ─────────────────────────────────────────────────────────────────────

export const JobCheckpointSchema = z.object({
  thread_id: z.string().uuid(),
  graph_started: z.boolean(),
  last_step: z.string().nullable(),
  rewind_to_step: z.string().nullable(),
})
export type JobCheckpoint = z.infer<typeof JobCheckpointSchema>

export const JobRowSchema = z.object({
  id: z.string().uuid(),
  idea_id: z.string().uuid(),
  priority: PrioritySchema,
  effective_priority: z.number().int(),
  status: JobStatusSchema,
  attempts: z.number().int().nonnegative(),
  current_step: z.string().nullable(),
  checkpoint: JobCheckpointSchema.nullable(),
  idempotency_key: z.string().nullable(),
  enqueued_at: z.coerce.date(),
  started_at: z.coerce.date().nullable(),
  finished_at: z.coerce.date().nullable(),
  error: z.string().nullable(),
})
export type JobRow = z.infer<typeof JobRowSchema>

// ─── API request bodies ──────────────────────────────────────────────────────

export const RetryStepBodySchema = z.object({
  step: z.string().optional(),
})

export const PriorityBodySchema = z.object({
  priority: PrioritySchema,
})

// ─── Pipeline ────────────────────────────────────────────────────────────────

export const ExecutorKindSchema = z.union([z.literal('fixture'), z.string()])

export const PipelineStepSchema = z.object({
  id: z.string(),
  role: z.string(),
  title: z.string(),
  executor: ExecutorKindSchema,
  timeoutMs: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  funnelStageAfter: FunnelStageSchema.optional(),
})
export type PipelineStep = z.infer<typeof PipelineStepSchema>

// ─── API responses ───────────────────────────────────────────────────────────

export const JobResponseSchema = z.object({
  job: z.object({
    id: z.string().uuid(),
    idea_id: z.string().uuid(),
    priority: PrioritySchema,
    status: JobStatusSchema,
    attempts: z.number().int().nonnegative(),
    current_step: z.string().nullable(),
    enqueued_at: z.coerce.date(),
    started_at: z.coerce.date().nullable(),
    finished_at: z.coerce.date().nullable(),
    error: z.string().nullable(),
  }),
  idea: z.object({
    id: z.string().uuid(),
    title: z.string(),
    funnel_stage: FunnelStageSchema,
    execution_status: ExecutionStatusSchema,
  }),
})

export const EnqueueResponseSchema = z.object({
  job: JobRowSchema,
  created: z.boolean(),
})

export const TranscribeSuccessSchema = z.object({
  ok: z.literal(true),
  text: z.string(),
  durationSec: z.number(),
  cost: z.number(),
})

export const TranscribeEmptySchema = z.object({
  ok: z.literal(false),
  code: z.literal('empty_transcript'),
  message: z.string(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Валидация UUID из route param — бросает 400 при ошибке */
export function parseUuid(value: string | undefined): string {
  return UuidParamSchema.parse({ id: value }).id
}

/** Валидация тела POST/ PATCH запроса — бросает 400 при ошибке */
export function parseBody<T extends z.ZodType>(
  data: unknown,
  schema: T,
): z.infer<T> {
  return schema.parse(data)
}

/** Безопасный парсинг — не бросает, возвращает result */
export function safeParse<T extends z.ZodType>(
  data: unknown,
  schema: T,
): z.SafeParseReturnType<unknown, z.infer<T>> {
  return schema.safeParse(data)
}

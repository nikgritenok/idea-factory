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
  priority: PrioritySchema.default('medium'),
  source_kind: SourceKindSchema.default('text'),
  transcript: z.string().trim().min(1, 'Текст идеи пуст'),
})

export const IdeaRowSchema = z.object({
  assumptions: z.unknown().nullable(),
  audience: z.string().nullable(),
  constraints: z.unknown().nullable(),
  created_at: z.coerce.date(),
  execution_status: ExecutionStatusSchema,
  funnel_stage: FunnelStageSchema,
  id: z.string().uuid(),
  priority: PrioritySchema,
  problem: z.string().nullable(),
  source_kind: SourceKindSchema,
  source_transcript: z.string().nullable(),
  structured_idea: z.unknown().nullable(),
  title: z.string(),
  updated_at: z.coerce.date(),
  value: z.string().nullable(),
  version: z.number().int().nonnegative(),
})
export type IdeaRow = z.infer<typeof IdeaRowSchema>

// ─── Job ─────────────────────────────────────────────────────────────────────

export const JobCheckpointSchema = z.object({
  graph_started: z.boolean(),
  last_step: z.string().nullable(),
  rewind_to_step: z.string().nullable(),
  thread_id: z.string().uuid(),
})
export type JobCheckpoint = z.infer<typeof JobCheckpointSchema>

export const JobRowSchema = z.object({
  attempts: z.number().int().nonnegative(),
  checkpoint: JobCheckpointSchema.nullable(),
  current_step: z.string().nullable(),
  effective_priority: z.number().int(),
  enqueued_at: z.coerce.date(),
  error: z.string().nullable(),
  finished_at: z.coerce.date().nullable(),
  id: z.string().uuid(),
  idea_id: z.string().uuid(),
  idempotency_key: z.string().nullable(),
  priority: PrioritySchema,
  started_at: z.coerce.date().nullable(),
  status: JobStatusSchema,
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
  executor: ExecutorKindSchema,
  funnelStageAfter: FunnelStageSchema.optional(),
  id: z.string(),
  retries: z.number().int().nonnegative(),
  role: z.string(),
  timeoutMs: z.number().int().positive(),
  title: z.string(),
})
export type PipelineStep = z.infer<typeof PipelineStepSchema>

// ─── API responses ───────────────────────────────────────────────────────────

export const JobResponseSchema = z.object({
  idea: z.object({
    execution_status: ExecutionStatusSchema,
    funnel_stage: FunnelStageSchema,
    id: z.string().uuid(),
    title: z.string(),
  }),
  job: z.object({
    attempts: z.number().int().nonnegative(),
    current_step: z.string().nullable(),
    enqueued_at: z.coerce.date(),
    error: z.string().nullable(),
    finished_at: z.coerce.date().nullable(),
    id: z.string().uuid(),
    idea_id: z.string().uuid(),
    priority: PrioritySchema,
    started_at: z.coerce.date().nullable(),
    status: JobStatusSchema,
  }),
})

export const EnqueueResponseSchema = z.object({
  created: z.boolean(),
  job: JobRowSchema,
})

export const TranscribeSuccessSchema = z.object({
  cost: z.number(),
  durationSec: z.number(),
  ok: z.literal(true),
  text: z.string(),
})

export const TranscribeEmptySchema = z.object({
  code: z.literal('empty_transcript'),
  message: z.string(),
  ok: z.literal(false),
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

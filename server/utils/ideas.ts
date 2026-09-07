import { IDEA_LIMIT_ACTIVE } from './schemas'

export { IDEA_LIMIT_ACTIVE }

export function titleFromTranscript(transcript: string): string {
  const firstSentence = transcript.trim().split(/[.!?…\n]/)[0] ?? ''
  const clipped
    = firstSentence.length > 119 ? `${firstSentence.slice(0, 119)}…` : firstSentence
  return clipped || 'Без названия'
}

export async function countActiveIdeas(sql: ReturnType<typeof import('postgres')>): Promise<number> {
  const rows = await sql`
    select count(*) as n from ideas where funnel_stage != 'archived'`
  return Number(rows[0].n)
}

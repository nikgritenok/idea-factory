import { db } from '../utils/db'
import { IDEA_LIMIT_ACTIVE } from './schemas'

export { IDEA_LIMIT_ACTIVE }

export function titleFromTranscript(transcript: string): string {
  const firstSentence = transcript.trim().split(/[.!?…\n]/)[0] ?? ''
  const clipped
    = firstSentence.length > 119 ? `${firstSentence.slice(0, 119)}…` : firstSentence
  return clipped || 'Без названия'
}

export async function countActiveIdeas(): Promise<number> {
  const result = await db.orm.public.Ideas
    .where((f) => f.funnelStage.neq('archived'))
    .aggregate((a) => ({ n: a.count() }))
  return result.n
}

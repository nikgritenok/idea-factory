import { db } from '../../utils/db'
import { countActiveIdeas, titleFromTranscript } from '../../utils/ideas'
import { IDEA_LIMIT_ACTIVE, IdeaCreateSchema } from '../../utils/schemas'

export default defineEventHandler(async (event) => {
  const sql = db()

  const body = await readBody(event)
  const parsed = IdeaCreateSchema.parse(body)

  const activeCount = await countActiveIdeas(sql)
  if (activeCount >= IDEA_LIMIT_ACTIVE) {
    throw createError({
      statusCode: 409,
      statusMessage: `Достигнут лимит ${IDEA_LIMIT_ACTIVE} активных идей. Заархивируйте что-нибудь`,
    })
  }

  const title = titleFromTranscript(parsed.transcript)

  const rows = await sql`
    insert into ideas (title, source_transcript, source_kind, priority, funnel_stage, execution_status)
    values (${title}, ${parsed.transcript}, ${parsed.source_kind}, ${parsed.priority}, 'draft', 'paused')
    returning *`
  const idea = IdeaRowSchema.parse(rows[0])

  await sql`
    insert into idea_versions (idea_id, version, snapshot, changed_fields)
    values (${idea.id}, 1, ${sql.json(idea)}, ${sql.json({ created: true })})`

  setResponseStatus(event, 201)
  return { idea }
})

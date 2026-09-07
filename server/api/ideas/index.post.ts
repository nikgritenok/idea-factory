import { db } from "../../utils/db";
import {
  countActiveIdeas,
  titleFromTranscript,
  IDEA_LIMIT_ACTIVE,
  type IdeaRow,
} from "../../utils/ideas";

export default defineEventHandler(async (event) => {
  const sql = db();

  const body = await readBody<{
    transcript?: string;
    source_kind?: "text" | "voice";
    priority?: "high" | "medium" | "low";
  }>(event);

  const transcript = (body.transcript ?? "").trim();
  if (!transcript) {
    throw createError({ statusCode: 400, statusMessage: "Текст идеи пуст" });
  }

  const activeCount = await countActiveIdeas(sql);
  if (activeCount >= IDEA_LIMIT_ACTIVE) {
    throw createError({
      statusCode: 409,
      statusMessage: `Достигнут лимит ${IDEA_LIMIT_ACTIVE} активных идей. Заархивируйте что-нибудь`,
    });
  }

  const sourceKind = body.source_kind === "voice" ? "voice" : "text";
  const title = titleFromTranscript(transcript);

  const rows = await sql`
    insert into ideas (title, source_transcript, source_kind, priority, funnel_stage, execution_status)
    values (${title}, ${transcript}, ${sourceKind}, ${body.priority ?? "medium"}, 'draft', 'paused')
    returning *`;
  const idea = rows[0] as IdeaRow;

  await sql`
    insert into idea_versions (idea_id, version, snapshot, changed_fields)
    values (${idea.id}, 1, ${sql.json(idea)}, ${sql.json({ created: true })})`;

  setResponseStatus(event, 201);
  return { idea };
});

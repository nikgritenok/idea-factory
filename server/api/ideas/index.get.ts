import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  const sql = db()
  const rows = await sql`
    select * from ideas
    where funnel_stage != 'archived'
    order by
      case priority when 'high' then 0 when 'medium' then 1 else 2 end,
      created_at desc`
  return { ideas: rows }
})

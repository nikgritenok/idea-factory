import { useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { buildEfficiencyView } from '../../../utils/efficiency-view'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/calculations — расчёты эффективности (экран «Прогоны», TZ §5)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const rows = await db.orm.public.Calculations
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.createdAt.desc())
    .limit(10)
    .all()

  log.set({ calculations: { count: rows.length } })

  // `seed` в БД — BigInt: JSON.stringify на такой строке падал с
  // «Do not know how to serialize a BigInt» и весь экран «Прогоны и
  // эффективность» отвечал 500. Seed нужен только как отображаемое значение и
  // как аргумент повторного расчёта, поэтому уводим его в строку на границе API.
  //
  // `view` — человекочитаемая карточка (Пункт 3 ТЗ). Она собирается здесь, а не
  // в компоненте: клиент по правилу TZ §5 ничего не пересчитывает.
  return {
    calculations: rows.map((row) => {
      const plain = { ...row, seed: String(row.seed) }
      return { ...plain, view: buildEfficiencyView(plain) }
    }),
  }
})

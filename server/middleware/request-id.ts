import { useLogger } from 'evlog'

// evlog на Nitro генерирует requestId для широкого события, но наружу его не отдаёт
// (в отличие от next/express-адаптеров), и в event.context.requestId не пишет.
// Без этого шага клиент не имеет способа связать свой упавший запрос со строкой в
// .evlog/logs/<дата>.jsonl — а именно по requestId это и делается.
//
// Идентификатор берём из логгера, а не criбуем заново: middleware в Nitro выполняется
// ПОСЛЕ request-хука evlog, так что собственный randomUUID здесь разошёлся бы с логом.
export default defineEventHandler((event) => {
  const { requestId } = useLogger(event).getContext()

  if (requestId) {
    setHeader(event, 'X-Request-Id', requestId)
  }
})

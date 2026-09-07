import type postgres from 'postgres'

/** Тип SQL-клиента postgres.js */
export type Sql = ReturnType<typeof postgres>

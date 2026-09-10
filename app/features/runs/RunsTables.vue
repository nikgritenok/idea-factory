<script setup lang="ts">
interface RunRow {
  error: null | string
  finishedAt: null | string
  id: string
  isFixture: boolean
  startedAt: string
  status: string
  variant: string
}

interface RunCallRow {
  component: string
  componentVersion: null | string
  createdAt: string
  durationMs: null | number
  error: null | string
  id: string
  ok: boolean
}

defineProps<{
  calls: RunCallRow[]
  runs: RunRow[]
}>()

function fmtDate(iso: null | string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="space-y-6">
    <section
      class="space-y-3 rounded-2xl border bg-card p-6"
      aria-labelledby="runs-heading"
    >
      <h2
        id="runs-heading"
        class="text-lg font-bold"
      >
        Прогоны
      </h2>
      <p
        v-if="runs.length === 0"
        class="text-sm text-muted-foreground"
      >
        Прогонов ещё не было.
      </p>
      <table
        v-else
        class="w-full text-sm"
      >
        <thead>
          <tr class="border-b text-left text-[13px] font-medium text-muted-foreground">
            <th
              scope="col"
              class="py-2"
            >
              Вариант
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Статус
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Тип
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Начало
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Конец
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="run in runs"
            :key="run.id"
            class="border-b last:border-0"
          >
            <td class="py-2.5">
              {{ run.variant }}
            </td>
            <td class="py-2.5">
              {{ run.status }}
            </td>
            <td class="py-2.5">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="run.isFixture ? 'bg-accent/20' : 'bg-success-soft text-success'"
              >
                {{ run.isFixture ? 'FIXTURE' : 'реальный' }}
              </span>
            </td>
            <td class="py-2.5">
              {{ fmtDate(run.startedAt) }}
            </td>
            <td class="py-2.5">
              {{ fmtDate(run.finishedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section
      class="space-y-3 rounded-2xl border bg-card p-6"
      aria-labelledby="calls-heading"
    >
      <h2
        id="calls-heading"
        class="text-lg font-bold"
      >
        Журнал вызовов (последние 30)
      </h2>
      <p
        v-if="calls.length === 0"
        class="text-sm text-muted-foreground"
      >
        Вызовов пока не было.
      </p>
      <table
        v-else
        class="w-full text-sm"
      >
        <thead>
          <tr class="border-b text-left text-[13px] font-medium text-muted-foreground">
            <th
              scope="col"
              class="py-2"
            >
              Компонент
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Версия
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Длительность
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Статус
            </th>
            <th
              scope="col"
              class="py-2"
            >
              Когда
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="call in calls"
            :key="call.id"
            class="border-b last:border-0"
          >
            <td class="py-2.5">
              {{ call.component }}
            </td>
            <td class="py-2.5">
              {{ call.componentVersion ?? '—' }}
            </td>
            <td class="py-2.5">
              {{ call.durationMs != null ? `${call.durationMs} мс` : '—' }}
            </td>
            <td class="py-2.5">
              <span :class="call.ok ? 'text-success' : 'text-destructive'">{{ call.ok ? 'ок' : (call.error ?? 'ошибка') }}</span>
            </td>
            <td class="py-2.5">
              {{ fmtDate(call.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

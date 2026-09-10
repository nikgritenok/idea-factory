<script setup lang="ts">
import { PIPELINE_STEPS, PIPELINE_VERSION, QUEUE_CONFIG } from '~~/config/pipeline'

const EXECUTOR_LABELS: Record<string, string> = {
  calc: 'Детерминированный расчёт',
  fixture: 'Сборка (fixture, детерминированная)',
  llm: 'LLM (реальный вызов)',
}
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
        Настройки и документация
      </h1>
      <p class="text-sm text-muted-foreground">
        Управляемые параметры анализа — всё, что проверяющий может посмотреть и проверить.
      </p>
    </header>

    <section
      class="space-y-4 rounded-2xl border bg-card p-6"
      aria-labelledby="pipeline-heading"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="pipeline-heading"
          class="text-lg font-bold"
        >
          Пайплайн анализа
        </h2>
        <span class="rounded-full bg-primary-soft px-2.5 py-0.5 text-[13px] font-medium text-primary">
          версия {{ PIPELINE_VERSION }}
        </span>
      </div>
      <p class="text-sm leading-6 text-muted-foreground">
        Этапы, роли и лимиты задаются в конфиге <code class="rounded bg-muted px-1">config/pipeline.ts</code>
        — замена ИИ-провайдера или добавление этапа не требует изменений интерфейса.
      </p>
      <ol class="space-y-3">
        <li
          v-for="(step, i) in PIPELINE_STEPS"
          :key="step.id"
          class="flex items-start gap-3 rounded-xl bg-surface p-4"
        >
          <span
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {{ i + 1 }}
          </span>
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ step.title }}
            </p>
            <p class="text-xs text-muted-foreground">
              роль: {{ step.role }} · исполнитель: {{ EXECUTOR_LABELS[step.executor] ?? step.executor }}
              · таймаут: {{ Math.round(step.timeoutMs / 1000) }} с · повторов: {{ step.retries }}
              <template v-if="'funnelStageAfter' in step && step.funnelStageAfter">
                · этап воронки после шага: {{ step.funnelStageAfter }}
              </template>
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section
      class="space-y-3 rounded-2xl border bg-card p-6"
      aria-labelledby="queue-heading"
    >
      <h2
        id="queue-heading"
        class="text-lg font-bold"
      >
        Очередь (TZ §8)
      </h2>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div class="rounded-xl bg-surface p-4">
          <dt class="text-muted-foreground">
            Лимит активных идей
          </dt>
          <dd class="mt-1 text-lg font-bold">
            10
          </dd>
        </div>
        <div class="rounded-xl bg-surface p-4">
          <dt class="text-muted-foreground">
            Анти-голодание: порог ожидания
          </dt>
          <dd class="mt-1 text-lg font-bold">
            {{ QUEUE_CONFIG.antiStarvationMinutes }} мин → +{{ QUEUE_CONFIG.antiStarvationBump }} к приоритету
          </dd>
        </div>
        <div class="rounded-xl bg-surface p-4">
          <dt class="text-muted-foreground">
            Базовые веса приоритетов
          </dt>
          <dd class="mt-1 text-lg font-bold">
            high {{ QUEUE_CONFIG.priorityBase.high }} · medium {{ QUEUE_CONFIG.priorityBase.medium }} · low {{ QUEUE_CONFIG.priorityBase.low }}
          </dd>
        </div>
        <div class="rounded-xl bg-surface p-4">
          <dt class="text-muted-foreground">
            Интервал опроса очереди
          </dt>
          <dd class="mt-1 text-lg font-bold">
            {{ QUEUE_CONFIG.pollIntervalMs }} мс
          </dd>
        </div>
      </dl>
    </section>

    <section
      class="space-y-4 rounded-2xl bg-inverse-surface p-6 text-inverse-on-surface"
      aria-labelledby="docs-heading"
    >
      <h2
        id="docs-heading"
        class="text-lg font-bold"
      >
        Документация
      </h2>
      <ul class="space-y-2 text-sm">
        <li>
          <a
            href="/docs/ARCHITECTURE"
            class="underline hover:opacity-80"
            target="_blank"
            rel="noopener"
          >
            Архитектура (docs/ARCHITECTURE.md)
          </a>
          — стек, поток данных, структура проекта.
        </li>
        <li>
          <a
            href="/docs/CONVENTIONS"
            class="underline hover:opacity-80"
            target="_blank"
            rel="noopener"
          >
            Конвенции (docs/conventions.md)
          </a>
          — правила кода, API, тестирования, a11y.
        </li>
        <li>
          <a
            href="/docs/DEVLOG"
            class="underline hover:opacity-80"
            target="_blank"
            rel="noopener"
          >
            Журнал агентной разработки (DEVLOG.md)
          </a>
          — запрос → план → результат → проверка → исправление.
        </li>
        <li>
          <a
            href="/docs/TZ"
            class="underline hover:opacity-80"
            target="_blank"
            rel="noopener"
          >
            ТЗ (TZ.md)
          </a>
          — требования к продукту.
        </li>
      </ul>
      <p class="text-xs opacity-60">
        Документация открывается из исходников репозитория; раздел растёт вместе с проектом.
      </p>
    </section>

    <section
      class="space-y-3 rounded-2xl border bg-card p-6"
      aria-labelledby="limits-heading"
    >
      <h2
        id="limits-heading"
        class="text-lg font-bold"
      >
        Границы прототипа (честные упрощения)
      </h2>
      <ul class="list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Роли консолидированы до 7 шагов пайплайна (ТЗ разрешало объединение близких ролей).</li>
        <li>Один обработчик очереди — параллелизм всех 10 идей не требуется по ТЗ.</li>
        <li>Базовые метрики исходного процесса — модельный датасет (simulation), не измерение реального процесса.</li>
        <li>Владелец — единственный авторизованный пользователь; проверяющий получает read-only демо-режим.</li>
      </ul>
    </section>
  </div>
</template>

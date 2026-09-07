-- 0001_initial.up.sql — схема БД «Фабрики идей» (TZ §2, §6, §8, §9)
-- Все времена — timestamptz (UTC). Идентификаторы — uuid.

-- Идеи (карточка идей TZ §2)
create table ideas (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(title) <= 500),
    source_transcript text,
    source_kind text not null default 'text' check (source_kind in ('text', 'voice')),
    structured_idea jsonb,
    problem text,
    audience text,
    value text,
    constraints jsonb,
    assumptions jsonb,
    priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
    funnel_stage text not null default 'draft' check (funnel_stage in (
        'draft', 'queued', 'research', 'critical_evaluation',
        'decision', 'mvp_in_progress', 'mvp_ready', 'archived'
    )),
    execution_status text not null default 'paused' check (execution_status in (
        'running', 'paused', 'error', 'waiting_for_data'
    )),
    original_process_description text,
    baseline_metrics jsonb,
    expected_effect jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1
);

create index ideas_funnel_stage_idx on ideas (funnel_stage);
create index ideas_priority_created_idx on ideas (priority, created_at);

-- Версии карточек (история изменений, TZ §2/§3)
create table idea_versions (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    version integer not null,
    snapshot jsonb not null,
    changed_fields jsonb,
    created_at timestamptz not null default now(),
    unique (idea_id, version)
);

create index idea_versions_idea_idx on idea_versions (idea_id, version desc);

-- Аудио (голосовые записи, TZ §2/§11)
create table audio_files (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    storage_path text not null,
    mime_type text not null,
    duration_sec numeric(10, 2),
    size_bytes bigint,
    created_at timestamptz not null default now()
);

create index audio_files_idea_idx on audio_files (idea_id);

-- Источники (доказательность TZ §4: URL + источник + дата)
create table sources (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    report_version integer,
    url text not null,
    title text,
    published_at timestamptz,
    accessed_at timestamptz not null default now(),
    supports text,
    evidence_kind text not null default 'fact' check (evidence_kind in (
        'fact', 'estimate', 'forecast', 'simulation', 'synthetic'
    )),
    created_at timestamptz not null default now()
);

create index sources_idea_idx on sources (idea_id);

-- Результаты ролей пайплайна (TZ §7)
create table agent_outputs (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    run_id uuid,
    role text not null,
    output jsonb,
    format_valid boolean not null default false,
    validation_error text,
    outdated boolean not null default false,
    created_at timestamptz not null default now()
);

create index agent_outputs_idea_role_idx on agent_outputs (idea_id, role, created_at desc);

-- Прогоны (протокол прогона TZ §9)
create table runs (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    dataset_id uuid,
    variant text not null,
    component_versions jsonb,
    config_version text,
    status text not null default 'running' check (status in (
        'running', 'completed', 'failed', 'partial'
    )),
    is_fixture boolean not null default false,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    error text
);

create index runs_idea_idx on runs (idea_id, started_at desc);

-- Журнал вызовов компонентов внутри прогона (TZ §9: входы/выходы/длительность)
create table run_calls (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references runs (id) on delete cascade,
    component text not null,
    component_version text,
    request jsonb,
    response jsonb,
    duration_ms integer,
    ok boolean not null default true,
    error text,
    created_at timestamptz not null default now()
);

create index run_calls_run_idx on run_calls (run_id, created_at);

-- Наборы данных (TZ §5/§9: один и тот же набор для сравнения)
create table datasets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    units text,
    period text,
    rows jsonb not null,
    row_count integer not null,
    missing_policy text,
    is_fixture boolean not null default false,
    created_at timestamptz not null default now()
);

-- Расчёты эффективности (детерминированный модуль TZ §5)
create table calculations (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    run_ids jsonb,
    model_version text not null,
    formula text not null,
    params jsonb not null,
    seed bigint not null,
    input_summary jsonb not null,
    result jsonb not null,
    warnings jsonb,
    created_at timestamptz not null default now()
);

create index calculations_idea_idx on calculations (idea_id, created_at desc);

-- Отчёты (сборка редактором, TZ §4/§7)
create table reports (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    version integer not null,
    sections jsonb not null,
    recommendation text check (recommendation in (
        'develop', 'validate_first', 'postpone', 'reject', 'insufficient_data'
    )),
    score numeric(4, 1),
    stop_factors jsonb,
    outdated boolean not null default false,
    created_at timestamptz not null default now(),
    unique (idea_id, version)
);

create index reports_idea_idx on reports (idea_id, version desc);

-- Очередь (TZ §8)
create table queue_jobs (
    id uuid primary key default gen_random_uuid(),
    idea_id uuid not null references ideas (id) on delete cascade,
    priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
    effective_priority integer not null default 0,
    status text not null default 'queued' check (status in (
        'queued', 'running', 'paused', 'done', 'cancelled', 'failed'
    )),
    attempts integer not null default 0,
    current_step text,
    checkpoint jsonb,
    idempotency_key text,
    enqueued_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    error text,
    unique (idempotency_key)
);

create index queue_jobs_pick_idx on queue_jobs (status, effective_priority desc, enqueued_at asc);
create index queue_jobs_idea_idx on queue_jobs (idea_id, enqueued_at desc);

-- Конфиги (промпты/роли/лимиты TZ §6/§7 — версия вместе с результатом)
create table config_versions (
    id uuid primary key default gen_random_uuid(),
    version text not null,
    config jsonb not null,
    created_at timestamptz not null default now(),
    unique (version)
);

-- Метаданные миграций ведёт приложение (см. server/db/migrate.ts)

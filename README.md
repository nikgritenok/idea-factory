# Idea factory

Turns a raw idea, typed or dictated, into a report someone can decide on: what the idea is, who it is for, what it would change in numbers, where it breaks, and whether to build it, test it first, or drop it.

## How it works

Seven stages run in order. Five are LLM roles: orchestrator, idea parser, market and audience, strategist, critic. Two are plain code: the effect calculation and the report assembly. The numbers never come from a model's prose.

Stages, prompts and limits live in `config/`, not in the UI, so the pipeline changes without touching components. Every model answer is validated against a Zod contract, and a malformed one fails its step instead of leaking into the report.

## Workflow

1. Create an idea by text or by voice. Audio goes through `POST /api/transcribe` first.
2. Start the analysis. The job enters a Postgres-backed queue, and `GET /api/jobs/:id/stream` pushes progress over SSE, so the page does not poll.
3. Read the report at `GET /api/ideas/:id/report`. Calculations, stage outputs and the critic's verdict sit on their own endpoints next to it.

A running job can be paused, resumed, cancelled, or retried from a chosen step. That matters when a provider rate-limits the fifth stage and you would rather not pay for the first four again.

## Quick start

Node LTS, pnpm, and Docker for the database.

```bash
cp .env.example .env      # LLM key, STT key, validator URL
docker compose up -d db   # PostgreSQL on 5433
pnpm install
pnpm db:migrate
pnpm dev                  # http://localhost:3000
pnpm worker               # queue worker, separate process
```

There is no hosted demo: the pipeline needs model keys and a speech-to-text account.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | database container |
| `LLM_API_KEY` | yes | model provider used for generation |
| `LLM_BASE_URL`, `LLM_MODEL` | no | any OpenAI-compatible endpoint, defaults in `config/llm.ts` |
| `ROUTERAI_API_KEY` | yes | speech to text, a separate service |
| `VALIDATOR_URL` | yes | rules microservice, `http://validator:3001` |
| `WORKER_MODE` | no | `true` makes the process drain the queue |
| `LANGSMITH_API_KEY`, `LANGSMITH_TRACING`, `LANGSMITH_PROJECT` | no | tracing of model calls |
| `APP_ENV` | no | `production` or `development` |

## API

| Area | Endpoints |
|---|---|
| Ideas | `GET, POST /api/ideas`, `GET, PATCH, DELETE /api/ideas/:id`, `POST /api/ideas/:id/run`, `POST /api/ideas/:id/mvp` |
| Results | `GET /api/ideas/:id/{report,calculations,runs,outputs,latest-job}`, `GET /api/ideas/:id/phases/:role/materials` |
| Jobs | `GET /api/jobs/:id`, `GET /api/jobs/:id/stream`, `POST /api/jobs/:id/{pause,resume,cancel,retry-step}`, `PATCH /api/jobs/:id/priority` |
| Other | `POST /api/transcribe`, `GET /api/health`, `GET /docs/:name` |

Errors use one shape: `{ status, message, data: { code, why, fix } }`. `/api/v1` is reserved for a future breaking change.

## When to use it

A team that collects ideas and wants a consistent first pass: the same questions asked every time, the arithmetic done in code, and the reasoning written down where it can be argued with. The report is aimed at a person who has to say yes or no, not at a market research team.

## Limitations

- The quality of the qualitative stages depends entirely on the model behind `LLM_MODEL`.
- The effect calculation is a model of the effect, not a forecast. The report prints its assumptions and shows how sensitive the result is to them.
- One idea per run, no batch mode.
- Speech to text is a paid third-party service, so voice input needs an account.

## Stack

Nuxt 4 (Vue 3, Nitro) and TypeScript, PostgreSQL 16 with Prisma 8, a Postgres-backed queue with LangGraph.js (StateGraph, checkpoints in Postgres), Zod on every boundary, Vitest and Playwright, Docker.

## Documentation

[`docs/ru.md`](docs/ru.md) is the full documentation in Russian: how to read the report, what the effect calculation counts and what it ignores, limits, data access and security, the glossary, the API reference and deploy steps.

## Contributing

Issues and pull requests are welcome. Run the test suite before opening a PR.

## License

MIT, see [LICENSE](LICENSE).

# Automated PR Reviewer — Backend

NestJS service that turns signed GitHub pull-request webhooks into durable, idempotent review cycles and incremental diff manifests for n8n.

This service turns signed GitHub PR webhooks into review cycles, incremental diff manifests, and Cursor-powered AI findings for n8n. Slack delivery is not implemented (outbox row only on complete).

## Stack

- NestJS 11, Prisma, PostgreSQL
- GitHub App authentication behind `GitHubAppPort`
- Cursor SDK (`@cursor/sdk`) behind `AiReviewerPort`
- Docker Compose (`api` + internal `postgres`)

## Local setup

1. Copy [`.env.example`](.env.example) to `.env` and fill values locally. Do not paste secrets into chat or commit `.env`.
2. Start the stack:

```bash
docker compose up --build
```

PostgreSQL is not published to the host. The API is on `http://localhost:3000`.

3. Health check: `GET /health`
4. Swagger UI: `GET /docs` (OpenAPI also at `/docs-json`)

Swagger lists these servers for Try it out:

- `http://localhost:3000`
- `https://code-reviewer-api.codefied.online`
- `https://f04f-182-180-189-17.ngrok-free.app`

Use **Authorize** with your `N8N_API_TOKEN` for orchestration routes.

Without Docker, point `DATABASE_URL` at a reachable Postgres instance, then:

```bash
npx prisma migrate deploy
npm run start:dev
```

## GitHub App (you configure this)

Create a GitHub App with:

| Permission | Access |
|---|---|
| Metadata | Read-only |
| Contents | Read-only |
| Pull requests | Read-only |

Subscribe to **Pull request** events (`opened` and `synchronize` are handled first).

Set the webhook URL to `https://<your-host>/webhooks/github`.

Provide these environment variables (or a mounted PEM path):

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH`
- `GITHUB_WEBHOOK_SECRET`
- optional `GITHUB_INSTALLATION_ID` for a single-tenant install
- `CURSOR_API_KEY` from [Cursor Dashboard → Integrations / API Keys](https://cursor.com/dashboard/integrations)
- optional `CURSOR_MODEL_ID` (default `composer-2.5`)

Install the app on the target org or repositories.

## n8n API

All orchestration routes require `Authorization: Bearer $N8N_API_TOKEN`.

| Method | Path |
|---|---|
| GET | `/api/v1/orchestration/repositories/:githubRepoId/pulls/:number` |
| POST | `/api/v1/orchestration/review-cycles/claim` |
| GET | `/api/v1/orchestration/review-cycles/:reviewCycleId/diff-manifest` |
| POST | `/api/v1/orchestration/review-cycles/:reviewCycleId/review` |
| POST | `/api/v1/orchestration/review-cycles/:reviewCycleId/complete` |
| POST | `/api/v1/orchestration/review-cycles/:reviewCycleId/fail` |

Suggested n8n order: claim → (optional) diff-manifest → **review** → complete.

`lastReviewedSha` advances only when a cycle completes successfully and the PR head still matches that cycle’s head SHA.

## Tests

```bash
npm test
```

GitHub is mocked. Persistence in tests uses an in-memory store that mirrors the unique constraints and transaction serialization used in production.

## Package manager

npm (NestJS default scaffold).

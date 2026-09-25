# Automated PR Reviewer — Backend

NestJS service that turns signed GitHub pull-request webhooks into durable, idempotent review cycles and incremental diff manifests for n8n.

This milestone does not run AI review or send Slack messages. Completion writes an outbox row for a future notifier.

## Stack

- NestJS 11, Prisma, PostgreSQL
- GitHub App authentication behind `GitHubAppPort`
- Docker Compose (`api` + internal `postgres`)

## Local setup

1. Copy [`.env.example`](.env.example) to `.env` and fill values locally. Do not paste secrets into chat or commit `.env`.
2. Start the stack:

```bash
docker compose up --build
```

PostgreSQL is not published to the host. The API is on `http://localhost:3000`.

3. Health check: `GET /health`

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

Install the app on the target org or repositories.

## n8n API

All orchestration routes require `Authorization: Bearer $N8N_API_TOKEN`.

| Method | Path |
|---|---|
| GET | `/api/v1/orchestration/repositories/:githubRepoId/pulls/:number` |
| POST | `/api/v1/orchestration/review-cycles/claim` |
| GET | `/api/v1/orchestration/review-cycles/:reviewCycleId/diff-manifest` |
| POST | `/api/v1/orchestration/review-cycles/:reviewCycleId/complete` |
| POST | `/api/v1/orchestration/review-cycles/:reviewCycleId/fail` |

`lastReviewedSha` advances only when a cycle completes successfully and the PR head still matches that cycle’s head SHA.

## Tests

```bash
npm test
```

GitHub is mocked. Persistence in tests uses an in-memory store that mirrors the unique constraints and transaction serialization used in production.

## Package manager

npm (NestJS default scaffold).

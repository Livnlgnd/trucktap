# TruckTap Backend — Team Sync

The TruckTap backend provides optional multi-device Team Sync for the desktop
app and PWA. Local-only usage never requires the server.

Two implementations share the same API contract:

- **Self-hosted:** Express 5 + Node SQLite (`server/`)
- **Hosted:** Vercel Functions + Neon Postgres (`api/`), powering
  https://trucktap-blush.vercel.app

See [WEB.md](WEB.md) for hosted deployment details.

## Self-hosted stack

- Node.js 24+ with the built-in `node:sqlite` database
- Express 5 API
- Zod request validation
- Signed HMAC bearer tokens
- scrypt password hashing
- SQLite WAL storage with transactional sync operations
- No native database dependencies

## Product behavior

- A workspace has an owner, shop members, and tech members.
- The owner creates a workspace. The device's current local vans, parts, and
  orders are uploaded atomically with registration.
- Teammates join with an 8-character workspace code and receive the shared
  snapshot.
- Local-first writes go to IndexedDB and a sync queue first. When online, the
  queue is pushed to `/api/sync/push`; acknowledged operations are removed.
- The server returns idempotent operation acknowledgements. Replaying the same
  operation is safe.
- Each completed batch bumps the organization revision. Clients poll the
  snapshot every 8 seconds when their local queue is clear and apply updates.
- Local changes are not replaced while the queue contains pending operations.
- Team Sync is optional. Disconnecting keeps a local copy and stops syncing.

## Running locally

From the repository root:

```bash
npm run install:all
npm run dev:full          # API on :8787 + Vite web app on :5173
```

Or run the backend by itself:

```bash
npm run server:dev        # tsx watch
npm run server:build      # compile to server/dist
npm run server:start      # build, then start
npm run server:smoke      # API integration smoke test
```

The server can serve the built PWA. After `npm run build`, run
`npm run server:start` and open `http://localhost:8787`. The server serves the
Vite output from `dist/` and handles SPA fallback, service worker headers, and
the API from one origin.

Desktop development starts all three processes:

```bash
npm run desktop:dev
```

Desktop production against a local backend:

```bash
npm run desktop:stack
```

## Environment

Copy `server/.env.example` to `server/.env` and set at least a strong
`JWT_SECRET` before exposing the service.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | API and optional PWA port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_PATH` | `server/data/trucktap.db` | SQLite database file |
| `JWT_SECRET` | development fallback | Signing secret; required in production |
| `CORS_ORIGINS` | localhost/Vite/Electron origins | Comma-separated allowed origins |
| `WEB_DIST` | `../dist` | Built PWA directory to serve |
| `NODE_ENV` | unset | Set to `production` to enable CSP/HSTS mode |

Production examples:

```text
JWT_SECRET=replace-with-64-random-bytes
CORS_ORIGINS=https://trucktap.example.com,trucktap://app
DATABASE_PATH=/var/lib/trucktap/trucktap.db
```

## API

All protected routes use `Authorization: Bearer <token>`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Create owner + workspace; optional local workspace import |
| `POST` | `/api/auth/login` | — | Sign in |
| `POST` | `/api/auth/join` | — | Create account with workspace join code |
| `GET` | `/api/org` | member | Workspace info + members |
| `PATCH` | `/api/org/member?userId=…` | owner | Change a shop/tech role |
| `DELETE` | `/api/org/member?userId=…` | owner | Remove a member |
| `POST` | `/api/workspace/import` | owner | Import into an empty workspace |
| `GET` | `/api/sync/snapshot` | member | Full teams workspace snapshot |
| `POST` | `/api/sync/push` | member | Push idempotent local mutation operations |

### Sync operations

- `part:increment`, `part:decrement`
- `part:create`, `part:update`, `part:delete`
- `template:load`
- `usage:reset`
- `order:submit`, `order:pick`, `order:restock`

Every client operation carries an `opId`; the server stores applied IDs per
workspace to prevent duplicate application. Failed operations are returned to
the client with an error, remain queued locally, and can be retried.

## Data model

- `organizations` — workspace, join code, plan, revision
- `users` — email, name, scrypt password hash
- `memberships` — one workspace per user, role: `owner`, `shop`, `tech`
- `vans`, `parts`, `orders` — scoped by `org_id` with composite keys
- `sync_operations` — applied op IDs for idempotency

Workspace IDs and part IDs are scoped per organization, so separate customers
can safely use the same seeded IDs.

## Security notes

- Set a strong `JWT_SECRET`; the default is development-only.
- Serve the API behind HTTPS when using it beyond localhost. The PWA service
  worker requires a secure context.
- Restrict `CORS_ORIGINS` in production.
- Authentication attempts are rate-limited in memory per process.
- SQL uses prepared statements.
- Electron uses a sandboxed preload and disables Node integration.
- There is currently no payment processor, password reset, or email delivery
  integration. Team Sync billing and one-time desktop license fulfillment are
  intentionally external to this backend.

## Docker

Build the PWA first, then the image:

```bash
npm run build
docker build -t trucktap .
docker run --rm -p 8787:8787 \
  -e JWT_SECRET=replace-with-a-long-random-secret \
  -e CORS_ORIGINS=http://localhost:8787 \
  -v trucktap-data:/data \
  trucktap
```

Or use `docker compose up --build` after building the PWA.

## Backups

SQLite WAL files live beside the database. Back up the database file and its
`-wal`/`-shm` companions together, or stop the server before copying the main
database file. Mount `/data` as a persistent volume in container deployments.

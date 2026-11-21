# TruckTap Web

**Live site:** https://trucktap-blush.vercel.app

The public site is the full TruckTap PWA, not a marketing mock-up. It includes
the offline-first clicker, shop pick-lists, template management, local CSV
export, and Team Sync.

## Hosted architecture

- **Frontend/PWA:** Vite build deployed as static assets on Vercel
- **Team Sync API:** Vercel Functions in `api/`
- **Database:** Neon Postgres, provisioned through the Vercel Neon integration
- **Local persistence:** IndexedDB/Dexie remains the source of truth on each
  device; the sync queue flushes to the hosted API when online
- **Service worker:** versioned by build; it never caches `/api/` responses

The hosted functions use the same request/response contract as the self-hosted
Express/SQLite backend in `server/`.

## Deployment

The project is linked to Vercel as `joshuas-projects-36819d49/trucktap`.

```bash
vercel link --yes --project trucktap
vercel env pull .env.production.local --environment production
npm run deploy:web
```

Required production environment variables:

- `DATABASE_URL` and the Neon-provided Postgres variables (connected through the
  Vercel Neon integration)
- `JWT_SECRET` (32+ random bytes)
- `CORS_ORIGINS` including the public site and `trucktap://app` for the desktop
  client
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to keep Vercel builds fast

`vercel.json` sets the production CSP and service-worker headers.
`.vercelignore` excludes local builds, installers, dependencies, and env files.

## Local web development

Use the self-hosted backend for local full-stack development:

```bash
npm run dev:full
```

Or use the hosted API against a local Vite dev server by creating `.env.local`
with the production `DATABASE_URL` and a local `JWT_SECRET`, then run:

```bash
vercel dev
```

Database schema creation is lazy and idempotent on the first API request.

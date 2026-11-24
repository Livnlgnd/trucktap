# TruckTap Web

**Primary (custom domain, GitHub Pages):** https://trucktap.net/  
**Vercel (API + fallback site):** https://trucktap-blush.vercel.app  
**GitHub Pages hostname:** https://livnlgnd.github.io/trucktap/

All deployments run the full TruckTap PWA: the offline-first clicker, shop
pick-lists, template management, local CSV export, and Team Sync.

The custom domain is attached to the GitHub Pages site. DNS is hosted on
Cloudflare with the GitHub Pages records set to DNS-only (proxy disabled). The
Team Sync API stays on Vercel and is called cross-origin from `trucktap.net`.

## Hosted architecture

- **Landing page:** `/` — product overview, workflow, pricing, FAQ, and CTAs
- **Install page:** `/app.html` - phone/desktop install instructions
- **App:** `/app/` - the installable PWA and full field/shop application
- **Frontend/PWA:** Vite multi-page build deployed to GitHub Pages at the custom
  domain root, with a Vercel deployment as a fallback
- **Team Sync API:** Vercel Functions in `api/`
- **Database:** Neon Postgres, provisioned through the Vercel Neon integration
- **Local persistence:** IndexedDB/Dexie remains the source of truth on each
  device; the sync queue flushes to the hosted API when online
- **Service worker:** scoped to its deploy path, versioned by build, caches both
  pages, and never caches `/api/` responses

The GitHub Pages site calls the Vercel API cross-origin. CORS on the Vercel API
allows `https://trucktap.net`, `https://www.trucktap.net`,
`https://livnlgnd.github.io`, and `trucktap://app` for the desktop app.

## Deployment

### GitHub Pages

GitHub Pages serves the built files from the `gh-pages` branch:

**https://trucktap.net/**  
**https://livnlgnd.github.io/trucktap/**

The production frontend build uses:

```text
VITE_BASE_PATH=/
VITE_API_URL=https://trucktap-blush.vercel.app
```

The deploy script also writes a `CNAME` file containing `trucktap.net`.

Deploy the latest build with:

```bash
npm run deploy:pages
```

The script builds with the root base path, publishes only the static bundle to
`gh-pages`, writes the `CNAME`, and keeps source files off the published branch.
The Pages site calls the Vercel-hosted API cross-origin.

### Vercel

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
- `CORS_ORIGINS` including both public sites and `trucktap://app`
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1` to keep hosted builds fast

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

# TruckTap — Van & Truck Restock Clicker

TruckTap is a local-first restock app for field service technicians and
shop/warehouse runners. Techs tap the parts they used on the van, then send a
restock list in one step. The shop sees a live pick-list and a consolidated
supplier order — online or offline.

**Live website:** https://livnlgnd.github.io/trucktap/

The landing page lives at `/`; the installable app is at `/app.html`.
Alternate deployment: https://trucktap-blush.vercel.app

The repository contains a complete three-part product:

- **Windows desktop app** packaged with Electron
- **Installable PWA** deployed on Vercel
- **Team Sync backend** with accounts, workspaces, roles, and real multi-device sync

## Quick start — full stack

```bash
npm run install:all      # root + server dependencies
npm run dev:full         # API :8787 + PWA dev server :5173
```

Open **http://127.0.0.1:5173** for the web app. The backend health check is at
**http://127.0.0.1:8787/api/health**.

To serve the built PWA and API from one production-style server:

```bash
npm run build
npm run server:start     # builds the backend, serves dist + API on :8787
```

Open **http://localhost:8787**.

## Desktop app

```bash
npm run desktop:dev      # API + Vite + Electron with hot reload
npm run desktop:stack    # API + production build + Electron
npm run desktop:start    # desktop app only (start the API separately)
npm run desktop:pack     # unpacked Windows app in release/win-unpacked/
npm run desktop:dist     # Windows installer in release/
```

The prebuilt installer is:

```text
release/TruckTap-Setup-1.1.3.exe
```

Desktop details:

- Native window with persisted size/position, menu bar, single-instance lock,
  and external-link protection.
- Rendered through a secure custom `trucktap://` protocol from built assets.
- Context isolation + sandboxed preload; Node integration is disabled.
- IndexedDB and the sync queue live in the app's user-data folder. Use
  **Help → Open Data Folder** in the desktop menu to open it.
- No service worker inside Electron; packaged assets are local.
- Team Sync connects to the backend at `http://127.0.0.1:8787` by default.
  The server address can be changed in **Team Sync → Server settings** while
  signed out, or set at build time with `VITE_API_URL`.

## License console (admin)

The Windows desktop app includes the internal License Console behind the admin
token. It is not shown in the customer-facing navigation.

- Open **Help → License Console…** or press **Ctrl+Shift+A**.
- Launch the console directly with `TruckTap.exe --admin`.
- Log in with the Worker secret `TRUCKTAP_ADMIN_TOKEN`. The token is encrypted
  with Windows DPAPI after the first successful login.
- The console lists Stripe and manually issued licenses, decodes plan limits,
  issues signed manual keys, and exports CSV.

## Team Sync backend

The backend is available in two deployment forms sharing the same API contract:

- **Self-hosted:** TypeScript/Express + Node SQLite (`server/`)
- **Hosted website:** Vercel Functions + Neon Postgres (`api/`), powering
  https://trucktap-blush.vercel.app and the GitHub Pages frontend at
  https://livnlgnd.github.io/trucktap/

It provides:

- Owner, shop, and tech accounts
- Workspace creation with atomic local-board import
- 8-character join codes for teammates
- Member role management and removal
- Idempotent push of offline operations
- Full workspace snapshot pulls
- ~8-second polling for remote changes
- Optional same-origin serving of the built PWA (self-hosted mode)

Full setup, API, environment, Docker, and security details are in
[docs/BACKEND.md](docs/BACKEND.md). Hosted deployment details are in
[docs/WEB.md](docs/WEB.md).

## PWA / web app

```bash
npm run dev
npm run build
npm run preview
```

The landing page is served at `/` and the field app at `/app.html`. The service
worker is registered by the app in production browser builds only. It caches
both entry pages and their assets, while skipping `/api/` responses so live Team
Sync data is never cached as app shell. Use the backend-served build at
`http://localhost:8787` or either hosted site to test Add to Home Screen and
offline app launches.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Dexie / IndexedDB with a transactional offline sync queue
- `dexie-react-hooks` live queries
- `lucide-react` icons
- Electron + electron-builder for Windows
- Express 5 + Zod + `node:sqlite` for Team Sync
- Installable PWA manifest + versioned service worker

## What is included

- **Marketing landing page** — product story, workflow, trade templates,
  Team Sync, one-time pricing tiers, add-ons, FAQ, and install/download CTAs.
- **Tech Clicker View** — van picker, optional job/unit tag, category filters,
  instant search, tactile cards, +1 tap, -1 tap, hold-to-undo, badge feedback,
  confirmation drawer, and daily tap reset.
- **Shop Pick-List View** — live metrics, per-van pick lists, item check-off,
  mark-restocked flow, consolidated supplier table, and CSV export.
- **Manage Van Templates** - add a van, add/edit/delete parts, set par levels,
  clear tap counts, load Electrical, Plumbing, or Multifamily starter templates,
  and reset local device data.
- **Team Sync** — create or join a shared workspace, invite via join code,
  manage members, monitor queue/sync state, and push data across devices.
- **Offline UX** — every local write commits to IndexedDB plus the sync queue in
  one transaction. Taps keep counting in dead zones; queued operations sync when
  the server is reachable. Remote updates wait while local operations are queued.
- **Clean first run** - new installs start with a guided setup that creates the
  first van and optionally loads an Electrical, Plumbing, or Multifamily parts
  template. No sample vans or orders ship in the app.
- **Commercial packaging** — see [docs/PRICING.md](docs/PRICING.md) for one-time
  Starter/Standard/Advanced licenses and the optional Team Sync add-on.

## Data model

`src/db.ts` owns the local IndexedDB schema and all writes. The `syncQueue`
stores an operation ID, action, entity, payload, timestamp, retry state, and
local error message. `src/hooks/useTeamSync.ts` pushes queued operations,
acknowledges only accepted IDs, and pulls server snapshots into Dexie.

`server/src/db.ts` owns the SQLite schema: organizations, users, memberships,
vans, parts, orders, and applied sync operations. Client operation IDs make
pushes idempotent, and each organization is scoped independently.

## Verification

```bash
npm run build
npm run lint
npm run server:smoke
```

`server:smoke` builds and runs API integration tests against an isolated SQLite
database. `npm run build` also type-checks the serverless Postgres API in
`api/`.

The hosted website is deployed with `npm run deploy:web`; the GitHub Pages
mirror is published with `npm run deploy:pages`.

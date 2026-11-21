# TruckTap Pricing & Licensing

**Positioning:** Buy once. Own it. Add sync only if you need it.

TruckTap is sold as a one-time software license. The desktop app and local PWA
are fully functional without an account or subscription. Cross-device Team Sync
is an optional recurring add-on.

## Plans

| | Starter | Standard | Advanced |
|---|---|---|---|
| Price | **$99 one-time** | **$199 one-time** | **$399 one-time** |
| Included vans | 3 | 10 | Unlimited |
| Shop workstations | 1 | 3 | Site license |
| Core offline clicker | ✓ | ✓ | ✓ |
| Pick-list + supplier CSV | ✓ | ✓ | ✓ |
| Trade templates | Starter presets | Custom templates | Custom + shared presets |
| Local backup / restore | Basic export | ✓ | ✓ |
| Updates included | 12 months | 12 months | 24 months |
| Support | Email | Priority email | Priority + onboarding |
| Optional maintenance renewal | $49/year | $99/year | $149/year |

- The app continues to work forever after purchase. Maintenance is optional and
  only covers updates and support.
- Major-version upgrades can be offered at a discounted upgrade price.
- Plans are sold per shop/license, not per technician. Field technicians should
  never be a pricing constraint.
- 14-day free trial with no card.

## Team Sync add-on

**$39/month**, optional on any plan:

- Real-time phone-to-shop synchronization through a hosted backend
- Shared order queue and live Shop Pick-List across devices
- Hosted backup and device recovery
- Still local-first: techs can tap and queue offline, then sync when connected

Team Sync is not required for single-workstation or local-only use. A
self-hosted/manual handoff option can remain available for customers who refuse
subscriptions.

## Licensing behavior

- One-time licenses are issued as signed offline license keys tied to the
  customer/license plan.
- The local app must remain usable without an internet connection or login.
- Do not gate offline tapping, core pick-lists, basic backups, or CSV export
  behind Team Sync.
- Without a hosted licensing check, enforcement is honor-system plus signed
  keys and van-count limits. Do not make the field workflow hostile to
  legitimate customers.
- Payment collection is handled by Stripe Checkout through the hosted
  TruckTap endpoints on the existing license Worker. A signed `TAP-...` key is
  issued after payment and is verified offline by the app.
- New installs start a 14-day local trial. After the trial ends, a valid
  signed license is required. Local data is never deleted.

## Purchase and license flow

1. Choose a plan on the landing page and open `checkout.html?plan=...`.
2. The page creates a Stripe Checkout session through
   `POST /api/trucktap/checkout-session` on
   `https://keytrack-license.joshua-c77.workers.dev`.
3. After payment, Stripe returns to `license.html?session_id=...`.
4. `GET /api/trucktap/license` verifies the paid session and signs a TruckTap
   ECDSA P-256 license key. Issued keys are cached in the Worker's D1 database.
5. The customer copies the key into **License & Downloads** in the app, where
   it is verified with the shipped public key.

## Implementation status

Implemented:

- Team Sync backend with accounts, workspaces, join codes, roles, and sync
- Desktop app and PWA integration
- Optional hosted Team Sync flow in the Team Sync view
- Offline signed license keys, 14-day trial, activation gate, and
  License & Downloads view
- Live Stripe checkout and license delivery endpoints on the license Worker
- Website checkout, license lookup, download, support, about, privacy, and
  terms pages

Still required for commercial launch:

1. Enforce purchased van limits in the app UI beyond the current plan display.
2. Connect Team Sync plan billing to the hosted backend.

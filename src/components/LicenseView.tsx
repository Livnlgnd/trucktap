import { useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import {
  PLAN_DETAILS,
  TRIAL_DAYS,
  TRIAL_MAX_VANS,
  updatesAreActive,
  type TruckTapLicenseState,
  type TruckTapPlanId,
} from '../lib/license'
import { isDesktopApp, WEBSITE_BASE } from '../lib/platform'
import { cn, pluralize } from '../lib/utils'
import { ConfirmDialog } from './ConfirmDialog'
import type { ToastTone } from './Toast'

const BASE = import.meta.env.BASE_URL
const CHECKOUT_BASE = `${BASE}checkout.html`
const LICENSE_PAGE = `${BASE}license.html`
const DOWNLOAD_PAGE = `${BASE}download.html`
const LICENSE_API =
  'https://keytrack-license.joshua-c77.workers.dev/api/trucktap/license'
const PLAN_ORDER: TruckTapPlanId[] = ['starter', 'standard', 'advanced']

function checkoutHref(plan: TruckTapPlanId): string {
  // The desktop app has no in-window checkout: open the hosted Stripe page in
  // the user's browser. The web build uses the page next to the app.
  const base = isDesktopApp() ? `${WEBSITE_BASE}checkout.html` : CHECKOUT_BASE
  return `${base}?plan=${plan}`
}

function licenseDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function LicenseActivationForm({
  activate,
  onToast,
  onActivated,
  compact = false,
}: {
  activate: (key: string) => Promise<TruckTapLicenseState>
  onToast: (message: string, tone?: ToastTone) => void
  onActivated: () => void
  compact?: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const key = value.trim()
    if (!key) {
      setError('Paste the license key from your purchase.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const state = await activate(key)
      onToast(`License activated: ${state.planName}.`, 'success')
      setValue('')
      onActivated()
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'That license key could not be activated.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
          License key
        </span>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={compact ? 3 : 4}
          spellCheck={false}
          autoComplete="off"
          placeholder="TAP-eyJ2IjoxLCJsaWNlbnNlSWQiOi..."
          className="w-full resize-none rounded-xl border-2 border-line bg-page px-3 py-3 font-mono text-xs leading-relaxed text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-ink transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle size={20} className="animate-spin" />
        ) : (
          <KeyRound size={19} />
        )}
        {busy ? 'Verifying license…' : 'Activate License'}
      </button>

      <p className="mt-2 text-center text-[10px] font-semibold leading-relaxed text-muted">
        Keys are verified offline on this device. No account needed.
      </p>
    </form>
  )
}

function RetrieveLicenseForm({
  activate,
  onToast,
}: {
  activate: (key: string) => Promise<TruckTapLicenseState>
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const [sessionId, setSessionId] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const id = sessionId.trim()
    if (!/^cs_/.test(id)) {
      setError('Enter the Stripe checkout session ID from your receipt.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const url = new URL(LICENSE_API)
      url.searchParams.set('session_id', id)
      const org = company.trim()
      if (org) url.searchParams.set('company', org)

      const response = await fetch(url.toString())
      const data = (await response.json().catch(() => ({}))) as {
        licenseKey?: string
        error?: string
      }
      if (!response.ok || !data.licenseKey) {
        throw new Error(data.error || 'That license could not be retrieved.')
      }

      const state = await activate(data.licenseKey)
      onToast(`License activated: ${state.planName}.`, 'success')
      setSessionId('')
      setCompany('')
    } catch (retrieveError) {
      setError(
        retrieveError instanceof Error
          ? retrieveError.message
          : 'That license could not be retrieved.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
          Stripe checkout session ID
        </span>
        <input
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="cs_live_..."
          className="min-h-12 w-full rounded-xl border-2 border-line bg-page px-3 font-mono text-xs text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
          Company <span className="font-semibold normal-case tracking-normal">(optional)</span>
        </span>
        <input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          autoComplete="organization"
          placeholder="Northside Electric"
          className="min-h-12 w-full rounded-xl border-2 border-line bg-page px-3 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-line bg-page px-4 text-sm font-black text-ink transition hover:bg-panel-2 disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle size={18} className="animate-spin" />
        ) : (
          <KeyRound size={18} className="text-accent" />
        )}
        {busy ? 'Retrieving license.' : 'Retrieve & activate'}
      </button>
    </form>
  )
}

function PlanPurchaseCards() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PLAN_ORDER.map((planId) => {
        const plan = PLAN_DETAILS[planId]
        const popular = planId === 'standard'
        return (
          <article
            key={planId}
            className={cn(
              'flex flex-col rounded-2xl border bg-panel p-4',
              popular ? 'border-accent shadow-md' : 'border-line',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted">
                  {plan.maxVans >= 9999 ? 'Unlimited vans' : `Up to ${plan.maxVans} vans`}
                </p>
                <h3 className="mt-1 text-xl font-black">{plan.name}</h3>
              </div>
              {popular && (
                <span className="rounded-full bg-accent px-2 py-1 text-[8px] font-black uppercase tracking-wider text-accent-ink">
                  Popular
                </span>
              )}
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight">
              ${plan.price}
              <span className="ml-1 text-[10px] font-bold text-muted">
                one-time
              </span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-muted">
              Per shop · {plan.shopSeats >= 9999 ? 'unlimited' : plan.shopSeats} shop
              {plan.shopSeats === 1 ? ' station' : ' stations'}
            </p>
            <a
              href={checkoutHref(planId)}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'mt-4 flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black transition',
                popular
                  ? 'bg-accent text-accent-ink hover:brightness-105'
                  : 'border border-line bg-page text-ink hover:bg-panel-2',
              )}
            >
              Buy {plan.name}
              <ExternalLink size={14} />
            </a>
          </article>
        )
      })}
    </div>
  )
}

function LicenseStatusCard({
  state,
  onRemove,
}: {
  state: TruckTapLicenseState
  onRemove: () => void
}) {
  if (state.valid) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.055] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <BadgeCheck size={25} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                License active
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                TruckTap {state.planName}
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                {state.company}
              </p>
            </div>
          </div>
          <span className="self-start rounded-full bg-emerald-600 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white dark:bg-emerald-400 dark:text-emerald-950">
            Activated
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              'Van limit',
              state.maxVans >= 9999 ? 'Unlimited' : String(state.maxVans),
            ],
            [
              'Shop stations',
              state.shopSeats >= 9999 ? 'Unlimited' : String(state.shopSeats),
            ],
            ['Updates until', licenseDate(state.updatesUntil)],
            ['License ID', state.licenseId?.slice(0, 18) ?? '—'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-panel/80 p-3"
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                {label}
              </p>
              <p className="mt-1 truncate text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-bold',
              updatesAreActive(state) ? 'text-success' : 'text-warn',
            )}
          >
            <CheckCircle2 size={14} />
            {updatesAreActive(state)
              ? 'Updates included'
              : 'Update window ended — app continues to work'}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto text-[10px] font-bold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Remove license from this device
          </button>
        </div>
      </div>
    )
  }

  const percentLeft = Math.max(
    0,
    Math.min(100, (state.trialDaysLeft / TRIAL_DAYS) * 100),
  )

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              state.trialExpired
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-accent/10 text-accent',
            )}
          >
            {state.trialExpired ? <TriangleAlert size={24} /> : <Sparkles size={24} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              {state.trialExpired ? 'Trial ended' : 'Free trial'}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              {state.trialExpired
                ? 'Activate TruckTap to keep working'
                : `${state.trialDaysLeft} ${pluralize(state.trialDaysLeft, 'day')} left`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Trial includes up to {TRIAL_MAX_VANS} vans and all local features.
              No account required.
            </p>
          </div>
        </div>
        <span
          className={cn(
            'self-start rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider',
            state.trialExpired
              ? 'bg-red-500/10 text-red-700 dark:text-red-300'
              : 'bg-accent/10 text-accent',
          )}
        >
          {state.trialExpired ? 'Expired' : 'Trial'}
        </span>
      </div>

      {!state.trialExpired && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${percentLeft}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-muted">
            <span>Started {licenseDate(state.trialStartedAt)}</span>
            <span>Ends {licenseDate(state.trialExpiresAt)}</span>
          </div>
        </div>
      )}

      {state.error && (
        <p className="mt-3 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
          {state.error}
        </p>
      )}
    </div>
  )
}

export function LicenseView({
  state,
  activate,
  remove,
  refresh,
  onToast,
}: {
  state: TruckTapLicenseState
  activate: (key: string) => Promise<TruckTapLicenseState>
  remove: () => Promise<TruckTapLicenseState>
  refresh: () => Promise<TruckTapLicenseState>
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const desktop = isDesktopApp()

  const confirmRemove = async () => {
    setRemoving(true)
    try {
      await remove()
      onToast('License removed from this device.', 'success')
      setRemoveOpen(false)
    } catch {
      onToast('Could not remove the license.', 'error')
    } finally {
      setRemoving(false)
    }
  }

  const recheck = async () => {
    setRefreshing(true)
    try {
      await refresh()
      onToast('License status refreshed.', 'info')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            License & downloads
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Your TruckTap license
          </h1>
          <p className="mt-1 text-sm text-muted">
            {desktop
              ? 'Activate a license, check your plan, or retrieve a purchase. Everything happens on this device.'
              : 'Activate a one-time license, check your plan, or install the app on another device.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void recheck()}
          disabled={refreshing}
          className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-panel px-4 text-xs font-black text-ink hover:bg-panel-2 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'animate-spin' : ''}
          />
          Recheck license
        </button>
      </div>

      <div className="space-y-4">
        <LicenseStatusCard state={state} onRemove={() => setRemoveOpen(true)} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <section className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <KeyRound size={19} className="text-accent" />
              <h2 className="text-base font-black">
                {state.valid ? 'Replace license key' : 'Activate a license'}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Paste the key from your purchase. It is verified offline and
              stays on this device.
            </p>
            <div className="mt-4">
              <LicenseActivationForm
                activate={activate}
                onToast={onToast}
                onActivated={() => undefined}
                compact
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <Download size={19} className="text-accent" />
              <h2 className="text-base font-black">
                {desktop ? 'This device' : 'Downloads & installs'}
              </h2>
            </div>

            {desktop ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  You are running the standalone Windows app. Activate, tap,
                  and send restock lists here without opening the website.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-xs font-bold text-success">
                  <CheckCircle2 size={17} />
                  Desktop app installed
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                    Retrieve a purchased license
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Paste the Stripe checkout session ID from your receipt. The
                    key is fetched and activated on this device.
                  </p>
                  <div className="mt-3">
                    <RetrieveLicenseForm
                      activate={activate}
                      onToast={onToast}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Use the Windows installer or install the PWA on a phone,
                  tablet, or shop computer.
                </p>
                <div className="mt-4 space-y-2">
                  <a
                    href={DOWNLOAD_PAGE}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-page px-4 text-sm font-bold transition hover:bg-panel-2"
                  >
                    <span className="flex items-center gap-2">
                      <Download size={17} className="text-accent" />
                      Download for Windows
                    </span>
                    <ExternalLink size={15} className="text-muted" />
                  </a>
                  <a
                    href={LICENSE_PAGE}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-page px-4 text-sm font-bold transition hover:bg-panel-2"
                  >
                    <span className="flex items-center gap-2">
                      <KeyRound size={17} className="text-accent" />
                      Retrieve a purchased license
                    </span>
                    <ExternalLink size={15} className="text-muted" />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-accent">
                One-time licenses
              </p>
              <h2 className="mt-1 text-lg font-black">Upgrade or add vans</h2>
            </div>
            <p className="text-xs font-semibold text-muted">
              Prices in USD · per shop
            </p>
          </div>
          <div className="mt-4">
            <PlanPurchaseCards />
          </div>
          {desktop && (
            <p className="mt-3 text-[10px] font-semibold leading-relaxed text-muted">
              Secure Stripe checkout opens in your default browser. After
              payment, return here and paste the session ID from your receipt
              to activate.
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={removeOpen}
        title="Remove this license?"
        description="The app will return to trial mode on this device. Your local data and purchases stay untouched."
        confirmLabel="Remove License"
        busy={removing}
        onCancel={() => {
          if (!removing) setRemoveOpen(false)
        }}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  )
}

export function LicenseGate({
  state,
  activate,
  onToast,
}: {
  state: TruckTapLicenseState
  activate: (key: string) => Promise<TruckTapLicenseState>
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const desktop = isDesktopApp()

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10 text-ink">
      <div className="w-full max-w-2xl">
        <div className="mb-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg">
            <KeyRound size={32} />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            TruckTap
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Your free trial has ended.
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Your local data is safe. Activate a one-time license to keep tapping
            and sending restock lists, or buy a plan below.
          </p>
          {state.trialExpired && state.trialExpiresAt && (
            <p className="mx-auto mt-1 max-w-lg text-[11px] font-semibold text-muted/80">
              Trial ended {licenseDate(state.trialExpiresAt)}
            </p>
          )}
          {state.error && (
            <p
              role="alert"
              className="mx-auto mt-3 max-w-md rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn"
            >
              {state.error}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-panel p-5 shadow-xl sm:p-7">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div>
              <h2 className="text-lg font-black">Already purchased?</h2>
              <p className="mt-1 text-xs text-muted">
                Paste your signed license key to unlock the app.
              </p>
              <div className="mt-4">
                <LicenseActivationForm
                  activate={activate}
                  onToast={onToast}
                  onActivated={() => undefined}
                  compact
                />
              </div>
              {desktop ? (
                <details className="mt-3 rounded-xl border border-line bg-page/60 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-accent">
                    Need to retrieve your license?
                  </summary>
                  <div className="mt-3">
                    <RetrieveLicenseForm
                      activate={activate}
                      onToast={onToast}
                    />
                  </div>
                </details>
              ) : (
                <a
                  href={LICENSE_PAGE}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                >
                  Need to retrieve your license?
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-page/70 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-success" />
                <p className="text-sm font-black">Buy once. Own it.</p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                No required subscription. Licenses start at $99 per shop.
              </p>
              <div className="mt-3 space-y-2">
                {PLAN_ORDER.map((planId) => {
                  const plan = PLAN_DETAILS[planId]
                  return (
                    <a
                      key={planId}
                      href={checkoutHref(planId)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 text-xs font-bold transition hover:border-accent/50"
                    >
                      <span>
                        {plan.name}
                        <span className="ml-1 font-semibold text-muted">
                          {plan.maxVans >= 9999
                            ? 'unlimited vans'
                            : `${plan.maxVans} vans`}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 font-black text-accent">
                        ${plan.price}
                        <Check size={13} />
                      </span>
                    </a>
                  )
                })}
              </div>
              {!desktop && (
                <a
                  href={DOWNLOAD_PAGE}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-ink"
                >
                  <Download size={13} />
                  Download the desktop app
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-semibold text-muted">
          {!desktop && (
            <>
              <button
                type="button"
                onClick={() => window.location.assign(BASE)}
                className="hover:text-ink hover:underline"
              >
                Back to the website
              </button>
              <span className="mx-2 text-muted/40">·</span>
            </>
          )}
          Support:{" "}
          <a
            href="https://github.com/Livnlgnd/trucktap/issues"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent hover:underline"
          >
            GitHub Issues
          </a>
        </p>
      </div>
    </div>
  )
}

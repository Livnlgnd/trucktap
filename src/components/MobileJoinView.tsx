import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Truck,
  WifiOff,
} from 'lucide-react'
import type { TeamSyncController } from '../hooks/useTeamSync'
import { setApiBaseUrl } from '../lib/api'
import { cn } from '../lib/utils'
import type { ToastTone } from './Toast'

type Mode = 'join' | 'signin' | 'scan'

const TEAM_SYNC_PURCHASE = 'https://trucktap.net/team-sync.html#subscribe'

function parsePairingPayload(value: string): { code: string; server?: string } {
  const text = value.trim()
  if (!text) return { code: '' }

  try {
    const parsed = JSON.parse(text) as { code?: unknown; server?: unknown }
    if (typeof parsed.code === 'string') {
      return {
        code: parsed.code.trim().toUpperCase(),
        server: typeof parsed.server === 'string' ? parsed.server.trim() : undefined,
      }
    }
  } catch {
    // Not JSON; try a URL or plain code below.
  }

  try {
    const url = new URL(text)
    const code = url.searchParams.get('code')?.trim() ?? ''
    const server = url.searchParams.get('server')?.trim() ?? ''
    if (code) {
      return { code: code.toUpperCase(), server: server || undefined }
    }
  } catch {
    // Plain join code.
  }

  const match = text.toUpperCase().match(/\b[A-Z0-9]{8}\b/)
  return { code: match?.[0] ?? '' }
}

export function MobileJoinView({
  controller,
  onToast,
}: {
  controller: TeamSyncController
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const [mode, setMode] = useState<Mode>('join')
  const [joinCode, setJoinCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'tech' | 'shop'>('tech')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null,
  )

  useEffect(() => {
    if (mode !== 'scan') return
    let cancelled = false

    const start = async () => {
      setScanError('')
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode('trucktap-qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            const payload = parsePairingPayload(decoded)
            if (!payload.code) return
            if (payload.server) setApiBaseUrl(payload.server)
            setJoinCode(payload.code)
            setMode('join')
            onToast('Shop code scanned. Finish joining below.', 'success')
            void scanner.stop().catch(() => undefined)
          },
          () => undefined,
        )
      } catch (scanFailure) {
        if (cancelled) return
        setScanError(
          scanFailure instanceof Error
            ? scanFailure.message
            : 'The camera could not start. Enter the join code instead.',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear()
            } catch {
              // The scanner node may already be gone.
            }
          })
      }
    }
  }, [mode, onToast])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')

    try {
      if (mode === 'signin') {
        await controller.signIn({ email, password })
        onToast('Signed in. Pulling your shop board.', 'success')
      } else {
        if (!joinCode.trim()) {
          throw new Error('Enter the 8-character join code from the shop desktop.')
        }
        await controller.joinWorkspace({
          name,
          email,
          password,
          joinCode: joinCode.trim().toUpperCase(),
          role,
        })
        onToast('Joined the shop. Your van board is ready.', 'success')
      }
      setPassword('')
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : 'That shop could not be joined.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-page px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg">
            <Truck size={32} />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            TruckTap Mobile
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Join your shop.
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Scan the QR code shown on your shop desktop, or enter the 8-character
            join code. Your vans and parts come from the shop.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-panel p-4 shadow-xl">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-page p-1">
            {[
              { id: 'join' as const, label: 'Join' },
              { id: 'scan' as const, label: 'Scan QR' },
              { id: 'signin' as const, label: 'Sign In' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id)
                  setError('')
                }}
                className={cn(
                  'min-h-12 rounded-lg text-xs font-black transition',
                  mode === item.id
                    ? 'bg-accent text-accent-ink shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {mode === 'scan' ? (
            <div className="mt-4">
              <div
                id="trucktap-qr-reader"
                className="overflow-hidden rounded-2xl border border-line bg-black"
              />
              {scanError && (
                <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">
                  {scanError}
                </p>
              )}
              <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-muted">
                <Camera size={14} /> Point the camera at the desktop QR code.
              </p>
              <button
                type="button"
                onClick={() => setMode('join')}
                className="mt-3 min-h-12 w-full rounded-xl border border-line bg-page px-4 text-xs font-black text-ink"
              >
                Enter the code instead
              </button>
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(event) => void submit(event)}>
              {mode === 'join' && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                    Join code
                  </span>
                  <div className="relative">
                    <KeyRound
                      size={18}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
                    />
                    <input
                      value={joinCode}
                      onChange={(event) =>
                        setJoinCode(
                          event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                        )
                      }
                      maxLength={8}
                      autoCapitalize="characters"
                      autoComplete="off"
                      placeholder="ABC12345"
                      className="min-h-14 w-full rounded-xl border-2 border-line bg-page pl-10 pr-3 font-mono text-lg font-black tracking-[0.15em] text-ink outline-none focus:border-accent"
                    />
                  </div>
                </label>
              )}

              {mode === 'join' && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'tech' as const, label: 'Tech' },
                    { id: 'shop' as const, label: 'Shop' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={cn(
                        'min-h-12 rounded-xl border-2 text-xs font-black transition',
                        role === item.id
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-line bg-page text-muted',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'join' && (
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                    Your name
                  </span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    placeholder="Alex Rivera"
                    className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none focus:border-accent"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@shop.com"
                  className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none focus:border-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={10}
                  placeholder="At least 10 characters"
                  className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none focus:border-accent"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-ink disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle size={20} className="animate-spin" />
                ) : mode === 'signin' ? (
                  <ArrowRight size={19} />
                ) : (
                  <QrCode size={19} />
                )}
                {busy
                  ? 'Connecting.'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Join the shop'}
              </button>
            </form>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-page/60 p-3 text-[11px] leading-relaxed text-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
            <span>
              The shop owner can show the QR code under Team Sync on the desktop.
              Team Sync is $39/month and optional.
            </span>
          </div>

          <a
            href={TEAM_SYNC_PURCHASE}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 text-[11px] font-black text-accent"
          >
            <CheckCircle2 size={16} /> Subscribe to Team Sync
          </a>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-[10px] font-semibold text-muted">
          <WifiOff size={13} /> Offline taps still save on this phone.
        </p>
      </div>
    </div>
  )
}

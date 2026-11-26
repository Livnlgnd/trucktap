import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Flashlight,
  FlashlightOff,
  LoaderCircle,
  ScanBarcode,
  X,
} from 'lucide-react'
import { haptic } from '../lib/utils'

type ScanMode = 'single' | 'batch'

interface ScannerInstance {
  start: (
    camera: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: () => void,
  ) => Promise<void>
  stop: () => Promise<void>
  clear: () => void
  getRunningTrackCapabilities?: () => MediaTrackCapabilities
  applyVideoConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
}

function beep(): void {
  try {
    const Context =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Context) return
    const context = new Context()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 1180
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.14, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.13)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.14)
    oscillator.onended = () => void context.close()
  } catch {
    // Sound is optional.
  }
}

export function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean
  onClose: () => void
  onDetected: (barcode: string) => void | Promise<void>
}) {
  const [mode, setMode] = useState<ScanMode>('single')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [batchCount, setBatchCount] = useState(0)
  const [lastCode, setLastCode] = useState('')
  const scannerRef = useRef<ScannerInstance | null>(null)
  const modeRef = useRef<ScanMode>('single')
  const recentRef = useRef(new Map<string, number>())
  const handledRef = useRef(false)
  const closeRef = useRef(onClose)
  const detectedRef = useRef(onDetected)

  closeRef.current = onClose
  detectedRef.current = onDetected
  modeRef.current = mode

  useEffect(() => {
    if (!open) return
    let cancelled = false
    handledRef.current = false
    recentRef.current.clear()
    setError('')
    setReady(false)
    setBatchCount(0)
    setLastCode('')
    setTorchOn(false)

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode('trucktap-barcode-reader') as unknown as ScannerInstance
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (decoded) => {
            const code = decoded.trim()
            if (!code) return
            const now = Date.now()
            const previous = recentRef.current.get(code) ?? 0
            if (now - previous < 1500) return
            recentRef.current.set(code, now)
            beep()
            haptic(35)
            setLastCode(code)
            setBatchCount((count) => count + 1)
            void Promise.resolve(detectedRef.current(code)).catch(() => undefined)
            if (modeRef.current === 'single') {
              if (handledRef.current) return
              handledRef.current = true
              void scanner
                .stop()
                .catch(() => undefined)
                .finally(() => {
                  if (!cancelled) closeRef.current()
                })
            }
          },
          () => undefined,
        )
        if (cancelled) return
        setReady(true)
        const capabilities = scanner.getRunningTrackCapabilities?.() as
          | { torch?: boolean }
          | undefined
        setTorchAvailable(Boolean(capabilities?.torch))
      } catch (scanFailure) {
        if (cancelled) return
        setError(
          scanFailure instanceof Error
            ? scanFailure.message
            : 'The camera could not start. Check camera permission and try again.',
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
  }, [open])

  const toggleTorch = async () => {
    const scanner = scannerRef.current
    if (!scanner?.applyVideoConstraints) return
    const next = !torchOn
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints)
      setTorchOn(next)
      haptic(20)
    } catch {
      setError('This camera does not support the flashlight toggle.')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-slate-950 text-white">
      <header className="safe-top flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={22} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-black">Scan item</p>
          <p className="text-[11px] font-semibold text-white/60">
            {mode === 'single' ? 'Single scan' : `Batch scan · ${batchCount} read`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === 'single' ? 'batch' : 'single'))
            setBatchCount(0)
          }}
          className="ml-auto rounded-full border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide"
        >
          {mode === 'single' ? 'Batch mode' : 'Single mode'}
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <div
          id="trucktap-barcode-reader"
          className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-60 w-60 max-h-[55vw] max-w-[55vw]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-xl border-l-4 border-t-4 border-accent" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-xl border-r-4 border-t-4 border-accent" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-xl border-b-4 border-l-4 border-accent" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-xl border-b-4 border-r-4 border-accent" />
            <span className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent/80" />
          </div>
        </div>
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center">
            <div>
              <LoaderCircle size={30} className="mx-auto animate-spin text-accent" />
              <p className="mt-3 text-xs font-bold text-white/70">
                Starting camera…
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <div className="max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-5">
              <ScanBarcode size={34} className="mx-auto text-accent" />
              <p className="mt-3 text-sm font-bold">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 min-h-12 w-full rounded-xl bg-accent px-4 text-xs font-black uppercase tracking-wide text-accent-ink"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="safe-bottom px-5 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void toggleTorch()}
            disabled={!torchAvailable}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 disabled:opacity-35"
            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
          >
            {torchOn ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-bold text-white/70">
              {lastCode
                ? `Last: ${lastCode}`
                : 'Point the camera at a UPC, EAN, QR, or Code-128 barcode.'}
            </p>
            {mode === 'batch' && (
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-success">
                <Check size={12} className="mr-1 inline" />
                Keep scanning, then close when finished
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-14 rounded-full bg-accent px-5 text-xs font-black uppercase tracking-wide text-accent-ink"
          >
            Done
          </button>
        </div>
      </footer>
    </div>
  )
}

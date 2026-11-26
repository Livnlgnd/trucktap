import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ClipboardList,
  PackageOpen,
  Search,
  ScanBarcode,
  Send,
  Truck,
  X,
} from 'lucide-react'
import type { PartItem, Van } from '../types'
import {
  addScannedPart,
  db,
  decrementPart,
  deletePart,
  findPartByBarcode,
  incrementPart,
  submitRestockOrder,
} from '../db'
import { lookupBarcode } from '../services/barcodeLookupService'
import { CATEGORIES, getCategoryMeta } from '../lib/templates'
import { cn, pluralize } from '../lib/utils'
import type { ToastTone } from './Toast'
import { ClickerTile } from './ClickerTile'
import { ConfirmSendDrawer } from './ConfirmSendDrawer'
import { BarcodeScannerModal } from './BarcodeScannerModal'

function sortParts(parts: PartItem[]): PartItem[] {
  const order = new Map(CATEGORIES.map((category, index) => [category.name, index]))
  return [...parts].sort((a, b) => {
    const categoryDelta =
      (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99)
    return categoryDelta || a.name.localeCompare(b.name)
  })
}

const EMPTY_PARTS: PartItem[] = []
const HOWTO_DISMISSED_KEY = 'trucktap.howto-dismissed'

export interface TechSandbox {
  parts: PartItem[]
  onIncrement: (partId: string) => void
  onDecrement: (partId: string) => void
  onScan: () => void
}

export function TechView({
  vans,
  van,
  onVanChange,
  onOpenManage,
  onToast,
  sandbox,
}: {
  vans: Van[]
  van: Van
  onVanChange: (vanId: string) => void
  onOpenManage: () => void
  onToast: (message: string, tone?: ToastTone) => void
  sandbox?: TechSandbox
}) {
  const liveParts =
    useLiveQuery(
      () => db.parts.where('vanId').equals(van.id).toArray(),
      [van.id],
    ) ?? EMPTY_PARTS
  const parts = sandbox?.parts ?? liveParts
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [jobTag, setJobTag] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanBanner, setScanBanner] = useState<{
    part: PartItem
    qty: number
    isNew: boolean
  } | null>(null)
  const [showHowTo, setShowHowTo] = useState(() => {
    if (sandbox) return false
    try {
      return !window.localStorage.getItem(HOWTO_DISMISSED_KEY)
    } catch {
      return true
    }
  })

  const dismissHowTo = () => {
    setShowHowTo(false)
    try {
      window.localStorage.setItem(HOWTO_DISMISSED_KEY, '1')
    } catch {
      // Dismissal is non-critical.
    }
  }

  const handleScannedBarcode = async (barcode: string) => {
    if (sandbox) {
      sandbox.onScan()
      return
    }
    try {
      const existing = await findPartByBarcode(van.id, barcode)
      if (existing) {
        await incrementPart(existing.id)
        const nextQty = existing.currentUsedToday + 1
        setScanBanner({
          part: { ...existing, currentUsedToday: nextQty },
          qty: nextQty,
          isNew: false,
        })
        onToast(`${existing.name} +1 · Saved locally`, 'success')
        return
      }

      const product = await lookupBarcode(barcode, {
        online: navigator.onLine,
      })
      const part = await addScannedPart({
        vanId: van.id,
        name: product.name,
        brand: product.brand,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        thumbnailUrl: product.thumbnailUrl,
        needsDetailsSync: product.needsDetailsSync,
        currentUsedToday: 1,
        parLevel: 10,
      })
      setScanBanner({ part, qty: 1, isNew: true })
      onToast(`${part.name} added (+1) · Saved locally`, 'success')
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : 'That barcode could not be saved.',
        'error',
      )
    }
  }

  const adjustScannedQty = async (delta: 1 | -1) => {
    if (!scanBanner) return
    if (delta > 0) {
      await incrementPart(scanBanner.part.id)
      setScanBanner((current) =>
        current ? { ...current, qty: current.qty + 1 } : current,
      )
    } else {
      await decrementPart(scanBanner.part.id)
      setScanBanner((current) =>
        current ? { ...current, qty: Math.max(0, current.qty - 1) } : current,
      )
    }
  }

  const undoScan = async () => {
    if (!scanBanner) return
    if (scanBanner.isNew) {
      await deletePart(scanBanner.part.id)
    } else {
      await decrementPart(scanBanner.part.id)
    }
    setScanBanner(null)
    onToast('Scan change undone.', 'info')
  }

  const sortedParts = useMemo(() => sortParts(parts), [parts])
  const usedParts = useMemo(
    () => sortedParts.filter((part) => part.currentUsedToday > 0),
    [sortedParts],
  )
  const totalQty = usedParts.reduce(
    (sum, part) => sum + part.currentUsedToday,
    0,
  )

  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const part of parts) {
      counts.set(part.category, (counts.get(part.category) ?? 0) + 1)
    }
    return counts
  }, [parts])

  const visibleParts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return sortedParts.filter((part) => {
      const inCategory =
        activeCategory === 'All' || part.category === activeCategory
      if (!inCategory) return false
      if (!term) return true

      return (
        part.name.toLowerCase().includes(term) ||
        part.category.toLowerCase().includes(term) ||
        (part.sku ?? '').toLowerCase().includes(term)
      )
    })
  }, [activeCategory, search, sortedParts])

  const clearFilters = () => {
    setSearch('')
    setActiveCategory('All')
  }

  const handleConfirm = async () => {
    try {
      const order = await submitRestockOrder(van.id, jobTag)
      setConfirmOpen(false)
      setJobTag('')
      onToast(
        `${order.items.length} line${
          order.items.length === 1 ? '' : 's'
        } sent for ${van.name}.`,
        'success',
      )
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : 'Could not send the restock list.',
        'error',
      )
    }
  }

  return (
    <div className="pb-40">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 sm:mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Field clicker
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Tap what you used
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every tap saves instantly on this device. No signal required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] font-bold text-muted sm:block">
            {pluralize(parts.length, 'part')} on board
          </div>
          <button
            type="button"
            data-tutorial="scan"
            onClick={() => {
              if (sandbox) sandbox.onScan()
              else setScannerOpen(true)
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent/40 bg-accent/10 px-4 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent/15"
          >
            <ScanBarcode size={19} />
            Scan Item
          </button>
        </div>
      </div>

      {showHowTo && (
        <section className="mb-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
              <Truck size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">New here? It takes three steps.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                {[
                  'Tap +1 for each part you use.',
                  'Add a job or unit number if you want.',
                  'Send the restock list to the shop.',
                ].map((step, index) => (
                  <p
                    key={step}
                    className="flex items-start gap-2 text-[11px] font-semibold leading-snug text-muted"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[9px] font-black text-accent">
                      {index + 1}
                    </span>
                    {step}
                  </p>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissHowTo}
              aria-label="Dismiss quick start"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              <Truck size={13} />
              Van
            </span>
            <div className="relative">
              <select
                value={van.id}
                onChange={(event) => onVanChange(event.target.value)}
                className="min-h-14 w-full appearance-none rounded-xl border-2 border-line bg-page px-4 pr-11 text-base font-extrabold text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
              >
                {vans.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={20}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              <ClipboardList size={13} />
              Job / Unit # <span className="normal-case tracking-normal text-muted/70">(optional)</span>
            </span>
            <input
              type="text"
              value={jobTag}
              onChange={(event) => setJobTag(event.target.value)}
              placeholder="Job / Unit # (Optional)"
              autoComplete="off"
              enterKeyHint="done"
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 text-base font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search
              size={20}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parts, SKU, or category…"
              autoComplete="off"
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page pl-11 pr-12 text-base font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div
          className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-xs font-bold transition active:scale-[0.98]',
              activeCategory === 'All'
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-line bg-page text-muted hover:border-muted hover:text-ink',
            )}
          >
            All
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                activeCategory === 'All'
                  ? 'bg-black/15'
                  : 'bg-panel-2 text-ink',
              )}
            >
              {parts.length}
            </span>
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.name)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-xs font-bold transition active:scale-[0.98]',
                activeCategory === category.name
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-page text-muted hover:border-muted hover:text-ink',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', category.dotClass)} />
              {category.filterLabel}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                  activeCategory === category.name
                    ? 'bg-black/15'
                    : 'bg-panel-2 text-ink',
                )}
              >
                {countsByCategory.get(category.name) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-sm font-bold text-muted">
          <span className="font-black text-ink">{visibleParts.length}</span>{' '}
          {visibleParts.length === 1 ? 'part' : 'parts'} shown
          {activeCategory !== 'All' && (
            <span> · {getCategoryMeta(activeCategory).filterLabel}</span>
          )}
        </p>
        <p className="text-xs font-semibold text-muted">
          {totalQty > 0
            ? `${totalQty} marked used this shift`
            : 'Tap +1 · hold a tile to undo'}
        </p>
      </div>

      {parts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-panel px-6 py-14 text-center">
          <PackageOpen size={40} className="mx-auto text-muted/60" />
          <h2 className="mt-3 text-lg font-black">This van board is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Add parts manually or load a starter trade template to get the
            clicker ready.
          </p>
          <button
            type="button"
            onClick={onOpenManage}
            className="mt-5 min-h-16 rounded-2xl bg-accent px-6 text-sm font-black uppercase tracking-wide text-accent-ink"
          >
            Manage Van Templates
          </button>
        </div>
      ) : visibleParts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-panel px-6 py-14 text-center">
          <Search size={38} className="mx-auto text-muted/60" />
          <h2 className="mt-3 text-lg font-black">No matching parts</h2>
          <p className="mt-1 text-sm text-muted">
            Try a different search term or category.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 min-h-14 rounded-xl border-2 border-line bg-page px-6 text-sm font-black text-ink hover:bg-panel-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 xl:grid-cols-4 xl:gap-4">
          {visibleParts.map((part, index) => (
            <ClickerTile
              key={part.id}
              part={part}
              tutorialItem={index === 0}
              tutorialStepper={index === 0}
              onIncrement={(partId) => {
                if (sandbox) {
                  sandbox.onIncrement(partId)
                  return
                }
                void incrementPart(partId).catch(() => {
                  onToast('That tap could not be saved.', 'error')
                })
              }}
              onDecrement={(partId) => {
                if (sandbox) {
                  sandbox.onDecrement(partId)
                  return
                }
                void decrementPart(partId).catch(() => {
                  onToast('That undo could not be saved.', 'error')
                })
              }}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 shadow-[0_-10px_40px_-18px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="safe-bottom mx-auto flex w-full max-w-7xl items-center gap-3 px-3 pt-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight sm:text-base">
              <span className="text-2xl font-black text-ink sm:text-3xl">
                {totalQty}
              </span>{' '}
              {totalQty === 1 ? 'part' : 'parts'} marked used
            </p>
            <p className="mt-0.5 hidden truncate text-xs font-semibold text-muted sm:block">
              {van.name} · saved on device
            </p>
            <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-muted sm:hidden">
              {van.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={totalQty === 0}
            className="flex min-h-16 shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-xs font-black uppercase tracking-wide text-accent-ink shadow-lg transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[280px] sm:px-6 sm:text-base"
          >
            <Send size={19} />
            SEND RESTOCK LIST
          </button>
        </div>
      </div>

      {scanBanner && (
        <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-2xl border border-success/40 bg-panel p-3 shadow-2xl sm:bottom-28">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <ScanBarcode size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ink">
                {scanBanner.part.name}
              </p>
              <p className="text-[11px] font-semibold text-success">
                Saved locally · queued for sync
              </p>
            </div>
            <button
              type="button"
              onClick={() => void undoScan()}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted"
            >
              Undo
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-page px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-muted">
              Qty
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void adjustScannedQty(-1)}
                className="h-8 w-8 rounded-lg border border-line text-sm font-black text-ink"
              >
                −
              </button>
              <span className="min-w-8 text-center text-sm font-black">
                {scanBanner.qty}
              </span>
              <button
                type="button"
                onClick={() => void adjustScannedQty(1)}
                className="h-8 w-8 rounded-lg border border-line text-sm font-black text-ink"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScannedBarcode}
      />

      <ConfirmSendDrawer
        open={confirmOpen}
        vanName={van.name}
        jobTag={jobTag}
        usedParts={usedParts}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  )
}

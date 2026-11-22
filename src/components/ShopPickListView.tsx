import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Package,
  PackageCheck,
  PackageOpen,
  Truck,
} from 'lucide-react'
import type { RestockOrder, RestockOrderItem } from '../types'
import { db, markOrderRestocked, toggleOrderItemPicked } from '../db'
import {
  downloadSupplierCsv,
  type SupplierOrderRow,
} from '../lib/csv'
import {
  cn,
  formatDateTime,
  isToday,
  pluralize,
} from '../lib/utils'
import type { ToastTone } from './Toast'

type ShopTab = 'byVan' | 'consolidated'

const EMPTY_ORDERS: RestockOrder[] = []

function StatusBadge({ status }: { status: RestockOrder['status'] }) {
  const label =
    status === 'pending'
      ? 'Awaiting picks'
      : status === 'picked'
        ? 'Ready to load'
        : 'Restocked'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider',
        status === 'pending' &&
          'bg-amber-500/15 text-amber-800 dark:text-amber-300',
        status === 'picked' &&
          'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
        status === 'restocked' &&
          'bg-slate-500/15 text-slate-700 dark:text-slate-300',
      )}
    >
      {label}
    </span>
  )
}

function Metric({
  icon: Icon,
  value,
  label,
  shortLabel,
  className,
}: {
  icon: typeof Truck
  value: number
  label: string
  shortLabel: string
  className: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex',
            className,
          )}
        >
          <Icon size={19} />
        </span>
        <p className="text-[10px] font-black uppercase leading-tight tracking-[0.12em] text-muted sm:text-xs">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums sm:text-4xl">{value}</p>
    </div>
  )
}

function PickedItemRow({
  item,
  onToggle,
}: {
  item: RestockOrderItem
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={item.picked}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition active:scale-[0.995]',
        item.picked
          ? 'border-emerald-600/25 bg-emerald-500/[0.055] dark:border-emerald-400/25'
          : 'border-line bg-page/50 hover:border-muted/60 hover:bg-panel-2',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition',
          item.picked
            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
            : 'border-muted/50 bg-panel',
        )}
      >
        {item.picked && <Check size={17} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-bold leading-snug',
            item.picked && 'text-muted line-through decoration-2',
          )}
        >
          {item.partName}
        </span>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wide text-muted">
          {item.sku || 'NO SKU'}
        </span>
      </span>
      <span
        className={cn(
          'flex h-9 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-black',
          item.picked
            ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300'
            : 'bg-ink text-page',
        )}
      >
        ×{item.qty}
      </span>
    </button>
  )
}

function OrderCard({
  order,
  busy,
  onToggleItem,
  onRestock,
}: {
  order: RestockOrder
  busy: boolean
  onToggleItem: (partId: string) => void
  onRestock: () => void
}) {
  const pickedLines = order.items.filter((item) => item.picked).length
  const allPicked = pickedLines === order.items.length
  const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0)
  const pickedQty = order.items.reduce(
    (sum, item) => sum + (item.picked ? item.qty : 0),
    0,
  )
  const progress =
    order.items.length === 0 ? 0 : (pickedLines / order.items.length) * 100

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-start gap-3 border-b border-line p-3.5 sm:p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Truck size={23} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black tracking-tight sm:text-lg">
              {order.vanName}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-muted">
            <Clock3 size={12} className="shrink-0" />
            <span>{formatDateTime(order.submittedAt)}</span>
            <span className="text-muted/40">·</span>
            <span className="font-mono uppercase">{order.id}</span>
          </p>
          {order.jobTag && (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md bg-panel-2 px-2 py-1 text-[10px] font-bold text-ink">
              <ClipboardList size={12} className="shrink-0 text-muted" />
              <span className="truncate">{order.jobTag}</span>
            </p>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-[11px] font-bold text-muted">
          <span>
            {pickedLines}/{order.items.length} lines picked
          </span>
          <span>
            {pickedQty}/{totalQty} units
          </span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {order.items.map((item) => (
            <PickedItemRow
              key={item.partId}
              item={item}
              onToggle={() => onToggleItem(item.partId)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onRestock}
          disabled={!allPicked || busy}
          className={cn(
            'mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black uppercase tracking-wide transition active:scale-[0.99]',
            allPicked
              ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 disabled:opacity-60'
              : 'cursor-not-allowed bg-panel-2 text-muted',
          )}
        >
          {busy ? (
            <LoaderCircle size={21} className="animate-spin" />
          ) : (
            <PackageCheck size={21} />
          )}
          {busy ? 'Saving…' : 'Mark Van Restocked'}
        </button>
        <p className="mt-2 text-center text-[10px] font-semibold text-muted">
          {allPicked
            ? 'All items picked — ready to close out.'
            : `Pick ${pluralize(
                order.items.length - pickedLines,
                'remaining line',
                'remaining lines',
              )} to finish this van.`}
        </p>
      </div>
    </article>
  )
}

export function ShopPickListView({
  onToast,
  onOpenTech,
}: {
  onToast: (message: string, tone?: ToastTone) => void
  onOpenTech?: () => void
}) {
  const orders =
    useLiveQuery(
      () => db.orders.orderBy('submittedAt').reverse().toArray(),
      [],
    ) ?? EMPTY_ORDERS
  const [tab, setTab] = useState<ShopTab>('byVan')
  const [restockingId, setRestockingId] = useState<string | null>(null)

  const activeOrders = orders.filter((order) => order.status !== 'restocked')
  const completedToday = orders.filter(
    (order) =>
      order.status === 'restocked' &&
      isToday(order.restockedAt ?? order.submittedAt),
  )
  const pendingVanCount = new Set(activeOrders.map((order) => order.vanId)).size
  const totalPartsNeeded = activeOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0),
    0,
  )

  const supplierRows = useMemo<SupplierOrderRow[]>(() => {
    const aggregated = new Map<
      string,
      {
        partName: string
        sku: string
        qty: number
        vanQty: Map<string, number>
      }
    >()

    for (const order of orders) {
      if (order.status === 'restocked') continue

      for (const item of order.items) {
        if (item.picked) continue

        const key =
          item.sku.trim().toLowerCase() || item.partName.trim().toLowerCase()
        const existing = aggregated.get(key)

        if (existing) {
          existing.qty += item.qty
          existing.vanQty.set(
            order.vanName,
            (existing.vanQty.get(order.vanName) ?? 0) + item.qty,
          )
        } else {
          aggregated.set(key, {
            partName: item.partName,
            sku: item.sku,
            qty: item.qty,
            vanQty: new Map([[order.vanName, item.qty]]),
          })
        }
      }
    }

    return [...aggregated.values()]
      .map((row) => ({
        partName: row.partName,
        sku: row.sku,
        qty: row.qty,
        vans: [...row.vanQty.entries()].map(([vanName, qty]) => ({
          vanName,
          qty,
        })),
      }))
      .sort((a, b) => a.partName.localeCompare(b.partName))
  }, [orders])

  const supplierUnits = supplierRows.reduce((sum, row) => sum + row.qty, 0)

  const handleToggleItem = (orderId: string, partId: string) => {
    void toggleOrderItemPicked(orderId, partId).catch(() => {
      onToast('Could not update that pick. Try again.', 'error')
    })
  }

  const handleRestock = async (order: RestockOrder) => {
    setRestockingId(order.id)
    try {
      await markOrderRestocked(order.id)
      onToast(`${order.vanName} marked restocked.`, 'success')
    } catch {
      onToast('Could not mark the van restocked.', 'error')
    } finally {
      setRestockingId(null)
    }
  }

  const handleExport = () => {
    if (supplierRows.length === 0) return
    downloadSupplierCsv(supplierRows)
    onToast(
      `Supplier CSV exported — ${pluralize(supplierRows.length, 'line')}.`,
      'success',
    )
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
          Shop &amp; warehouse
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          Morning restock board
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick from the bin, check off each line, and close out the van.
        </p>
      </div>

      <section
        aria-label="Restock summary"
        className="grid grid-cols-3 gap-2 sm:gap-4"
      >
        <Metric
          icon={Truck}
          value={pendingVanCount}
          label="Pending Vans to Restock"
          shortLabel="Pending Vans"
          className="bg-amber-500/12 text-amber-700 dark:text-amber-300"
        />
        <Metric
          icon={Package}
          value={totalPartsNeeded}
          label="Total Parts Needed"
          shortLabel="Parts Needed"
          className="bg-sky-500/12 text-sky-700 dark:text-sky-300"
        />
        <Metric
          icon={CheckCheck}
          value={completedToday.length}
          label="Completed Restocks Today"
          shortLabel="Completed Today"
          className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
        />
      </section>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-panel p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab('byVan')}
          aria-pressed={tab === 'byVan'}
          className={cn(
            'flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-xs font-black transition sm:text-sm',
            tab === 'byVan'
              ? 'bg-accent text-accent-ink shadow-md'
              : 'text-muted hover:bg-panel-2 hover:text-ink',
          )}
        >
          <ClipboardList size={18} />
          <span>
            <span className="sm:hidden">By Van</span>
            <span className="hidden sm:inline">By Van (Pick-List)</span>
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                tab === 'byVan' ? 'bg-black/15' : 'bg-panel-2 text-ink',
              )}
            >
              {activeOrders.length}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('consolidated')}
          aria-pressed={tab === 'consolidated'}
          className={cn(
            'flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-xs font-black transition sm:text-sm',
            tab === 'consolidated'
              ? 'bg-accent text-accent-ink shadow-md'
              : 'text-muted hover:bg-panel-2 hover:text-ink',
          )}
        >
          <FileSpreadsheet size={18} />
          <span>
            <span className="sm:hidden">Supplier Order</span>
            <span className="hidden sm:inline">Consolidated Supplier Order</span>
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                tab === 'consolidated'
                  ? 'bg-black/15'
                  : 'bg-panel-2 text-ink',
              )}
            >
              {supplierRows.length}
            </span>
          </span>
        </button>
      </div>

      {tab === 'byVan' ? (
        <div className="mt-4">
          {activeOrders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line bg-panel px-6 py-14 text-center">
              <PackageCheck size={42} className="mx-auto text-success" />
              <h2 className="mt-3 text-lg font-black">
                Every van is caught up
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                New tech lists will appear here automatically, even if they were
                submitted offline.
              </p>
              {onOpenTech && (
                <button
                  type="button"
                  onClick={onOpenTech}
                  className="mt-5 min-h-14 rounded-xl border-2 border-line bg-page px-6 text-sm font-black text-ink transition hover:bg-panel-2"
                >
                  Open the Tech clicker
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={restockingId === order.id}
                  onToggleItem={(partId) =>
                    handleToggleItem(order.id, partId)
                  }
                  onRestock={() => void handleRestock(order)}
                />
              ))}
            </div>
          )}

          {completedToday.length > 0 && (
            <section className="mt-7">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em] text-muted">
                  Completed today
                </h2>
                <span className="text-xs font-bold text-muted">
                  {completedToday.length}
                </span>
              </div>
              <div className="space-y-2">
                {completedToday.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3.5 py-3"
                  >
                    <CheckCircle2
                      size={21}
                      className="shrink-0 text-success"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {order.vanName}
                      </p>
                      <p className="truncate text-[10px] font-semibold text-muted">
                        {order.jobTag || 'No job tag'} ·{' '}
                        {formatDateTime(order.restockedAt ?? order.submittedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                      Restocked
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <section className="mt-4 overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Supplier order
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {supplierRows.length === 0
                  ? 'No unpicked parts across active vans.'
                  : `${pluralize(supplierRows.length, 'unique line')} · ${supplierUnits} units across ${pluralize(new Set(activeOrders.map((order) => order.vanId)).size, 'van')}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={supplierRows.length === 0}
              className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-black text-page transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 sm:shrink-0"
            >
              <Download size={19} />
              Export CSV
            </button>
          </div>

          {supplierRows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <PackageOpen size={42} className="mx-auto text-muted/60" />
              <h3 className="mt-3 text-lg font-black">Nothing to order</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Every unpicked line has been loaded. Picked items no longer
                appear on the supplier sheet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-page/60 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                    <th className="px-4 py-3">Part</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Vans</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierRows.map((row) => (
                    <tr
                      key={`${row.sku}-${row.partName}`}
                      className="border-b border-line/70 last:border-0 hover:bg-page/40"
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-sm font-bold">{row.partName}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-muted">
                        {row.sku || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {row.vans.map((van) => (
                            <span
                              key={van.vanName}
                              className="rounded-md bg-panel-2 px-1.5 py-1 text-[10px] font-bold text-muted"
                            >
                              {van.vanName.replace(/^Van /, '')} · {van.qty}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex min-w-11 justify-center rounded-lg bg-accent/10 px-2.5 py-1.5 text-sm font-black text-accent">
                          {row.qty}×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-page/60">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-xs font-black uppercase tracking-wider text-muted"
                    >
                      Supplier total
                    </td>
                    <td className="px-4 py-3 text-right text-base font-black">
                      {supplierUnits} units
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

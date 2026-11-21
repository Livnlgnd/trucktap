import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { PartItem, Van } from '../types'
import {
  db,
  deletePart,
  loadTemplate,
  resetDemoData,
  resetVanUsage,
} from '../db'
import {
  CATEGORIES,
  TRADE_PRESETS,
  getCategoryMeta,
} from '../lib/templates'
import { cn, partIdentity, pluralize } from '../lib/utils'
import { ConfirmDialog } from './ConfirmDialog'
import { PartIcon } from './PartIcon'
import { PartEditorModal } from './PartEditorModal'
import type { ToastTone } from './Toast'

const PRESET_TONES: Record<string, string> = {
  electrical: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  plumbing: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
  multifamily: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
}

const EMPTY_PARTS: PartItem[] = []

export function TemplateManager({
  vans,
  van,
  onVanChange,
  onToast,
  teamSyncActive = false,
}: {
  vans: Van[]
  van: Van
  onVanChange: (vanId: string) => void
  onToast: (message: string, tone?: ToastTone) => void
  teamSyncActive?: boolean
}) {
  const parts =
    useLiveQuery(
      () => db.parts.where('vanId').equals(van.id).toArray(),
      [van.id],
    ) ?? EMPTY_PARTS
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPart, setEditingPart] = useState<PartItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PartItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [usageResetOpen, setUsageResetOpen] = useState(false)
  const [resettingUsage, setResettingUsage] = useState(false)

  const sortedParts = useMemo(
    () =>
      [...parts].sort((a, b) => {
        const categoryOrder = new Map(
          CATEGORIES.map((category, index) => [category.name, index]),
        )
        return (
          (categoryOrder.get(a.category) ?? 99) -
            (categoryOrder.get(b.category) ?? 99) ||
          a.name.localeCompare(b.name)
        )
      }),
    [parts],
  )

  const visibleParts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sortedParts

    return sortedParts.filter(
      (part) =>
        part.name.toLowerCase().includes(term) ||
        part.category.toLowerCase().includes(term) ||
        (part.sku ?? '').toLowerCase().includes(term),
    )
  }, [search, sortedParts])

  const groups = useMemo(() => {
    const known = new Set(CATEGORIES.map((category) => category.name))
    const result = CATEGORIES.map((meta) => ({
      meta,
      parts: visibleParts.filter((part) => part.category === meta.name),
    })).filter((group) => group.parts.length > 0)

    const extraNames = [...new Set(visibleParts.map((part) => part.category))].filter(
      (name) => !known.has(name),
    )

    for (const name of extraNames) {
      result.push({
        meta: getCategoryMeta(name),
        parts: visibleParts.filter((part) => part.category === name),
      })
    }

    return result
  }, [visibleParts])

  const existingPartKeys = useMemo(
    () => new Set(parts.map(partIdentity)),
    [parts],
  )
  const usedCount = parts.reduce(
    (sum, part) => sum + part.currentUsedToday,
    0,
  )
  const parTotal = parts.reduce((sum, part) => sum + part.parLevel, 0)

  const openAdd = () => {
    setEditingPart(null)
    setEditorOpen(true)
  }

  const openEdit = (part: PartItem) => {
    setEditingPart(part)
    setEditorOpen(true)
  }

  const handleLoadPreset = async (preset: (typeof TRADE_PRESETS)[number]) => {
    setLoadingPreset(preset.id)
    try {
      const added = await loadTemplate(van.id, preset.parts, preset.id)
      if (added > 0) {
        onToast(
          `${preset.name}: added ${pluralize(added, 'part')} to ${van.name}.`,
          'success',
        )
      } else {
        onToast('Every part in that template is already on this board.', 'info')
      }
    } catch {
      onToast('Could not load that trade template.', 'error')
    } finally {
      setLoadingPreset(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePart(deleteTarget.id)
      onToast(`${deleteTarget.name} removed from the board.`, 'success')
      setDeleteTarget(null)
    } catch {
      onToast('Could not delete that part.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const confirmUsageReset = async () => {
    setResettingUsage(true)
    try {
      const count = await resetVanUsage(van.id)
      onToast(
        count > 0
          ? `Tap counts cleared on ${count} ${count === 1 ? 'line' : 'lines'}.`
          : 'No tap counts to clear.',
        'success',
      )
      setUsageResetOpen(false)
    } catch {
      onToast('Could not reset tap counts.', 'error')
    } finally {
      setResettingUsage(false)
    }
  }

  const confirmDemoReset = async () => {
    setResetting(true)
    try {
      await resetDemoData()
      onToast('Demo vans, templates, and orders restored.', 'success')
      setResetOpen(false)
    } catch {
      onToast('Could not reset the demo data.', 'error')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Template control
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Manage van templates
          </h1>
          <p className="mt-1 text-sm text-muted">
            Build each truck’s clicker board, set par levels, and load trade
            presets.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-black uppercase tracking-wide text-accent-ink shadow-lg transition active:scale-[0.99]"
        >
          <Plus size={20} strokeWidth={3} />
          Add Part
        </button>
      </div>

      <section className="rounded-2xl border border-line bg-panel p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="block min-w-0 flex-1 lg:max-w-md">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Van board
            </span>
            <div className="relative">
              <select
                value={van.id}
                onChange={(event) => {
                  onVanChange(event.target.value)
                  setSearch('')
                  setEditorOpen(false)
                  setDeleteTarget(null)
                }}
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

          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-line bg-page px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                Board
              </p>
              <p className="text-sm font-black">
                {pluralize(parts.length, 'part')}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-page px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                Par units
              </p>
              <p className="text-sm font-black">{parTotal}</p>
            </div>
            <div className="rounded-xl border border-line bg-page px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-muted">
                Used today
              </p>
              <p
                className={cn(
                  'text-sm font-black',
                  usedCount > 0 && 'text-emerald-700 dark:text-emerald-300',
                )}
              >
                {usedCount}
              </p>
            </div>
            {usedCount > 0 && (
              <button
                type="button"
                onClick={() => setUsageResetOpen(true)}
                className="min-h-14 rounded-xl border-2 border-line bg-page px-3 text-xs font-bold text-muted transition hover:border-amber-500/50 hover:text-ink"
              >
                Clear taps
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              Load Starter Trade Template
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              One tap adds the missing parts. Your existing board is kept.
            </p>
          </div>
          <span className="rounded-full border border-line bg-panel px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted">
            Add missing only
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {TRADE_PRESETS.map((preset) => {
            const missingCount = preset.parts.filter(
              (part) => !existingPartKeys.has(partIdentity(part)),
            ).length
            const isLoading = loadingPreset === preset.id

            return (
              <article
                key={preset.id}
                className="flex flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      PRESET_TONES[preset.id],
                    )}
                  >
                    <PartIcon name={preset.iconName} size={25} />
                  </div>
                  <span className="rounded-full bg-panel-2 px-2 py-1 text-[10px] font-black text-muted">
                    {pluralize(preset.parts.length, 'part')}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-black tracking-tight">
                  {preset.name}
                </h3>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                  {preset.description}
                </p>
                <button
                  type="button"
                  onClick={() => void handleLoadPreset(preset)}
                  disabled={missingCount === 0 || loadingPreset !== null}
                  className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-line bg-page px-4 text-sm font-black text-ink transition hover:border-accent/60 hover:bg-accent/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? (
                    <LoaderCircle size={19} className="animate-spin" />
                  ) : (
                    <Plus size={19} strokeWidth={3} />
                  )}
                  {isLoading
                    ? 'Loading…'
                    : missingCount === 0
                      ? 'All parts added'
                      : `Load template (${missingCount})`}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              Board parts
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {pluralize(parts.length, 'part')} on {van.name}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter parts…"
              className="min-h-12 w-full rounded-xl border-2 border-line bg-panel pl-9 pr-10 text-sm font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear part filter"
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>

        {parts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-panel px-6 py-14 text-center">
            <PartIcon
              name="Package"
              size={42}
              className="mx-auto text-muted/60"
            />
            <h3 className="mt-3 text-lg font-black">No parts on this board</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Add a part manually or load one of the trade templates above.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-5 min-h-16 rounded-2xl bg-accent px-6 text-sm font-black uppercase tracking-wide text-accent-ink"
            >
              Add First Part
            </button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-panel px-6 py-12 text-center">
            <Search size={36} className="mx-auto text-muted/60" />
            <h3 className="mt-3 text-lg font-black">No matching parts</h3>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-4 min-h-14 rounded-xl border-2 border-line bg-page px-5 text-sm font-bold"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div
                key={group.meta.name}
                className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-line bg-page/50 px-3.5 py-2.5">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md',
                      group.meta.iconClass,
                    )}
                  >
                    <PartIcon name={group.meta.iconName} size={14} />
                  </span>
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-muted">
                    {group.meta.name}
                  </h3>
                  <span className="ml-auto text-[10px] font-black text-muted">
                    {group.parts.length}
                  </span>
                </div>

                <div className="divide-y divide-line/70">
                  {group.parts.map((part) => (
                    <div
                      key={part.id}
                      className="flex min-h-16 items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          getCategoryMeta(part.category).iconClass,
                        )}
                      >
                        <PartIcon name={part.iconName} size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{part.name}</p>
                        <p className="truncate font-mono text-[10px] uppercase tracking-wide text-muted">
                          {part.sku || 'NO SKU'} · PAR {part.parLevel}
                        </p>
                      </div>
                      <div className="flex h-10 min-w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-panel-2 px-2">
                        <span
                          className={cn(
                            'text-sm font-black leading-none',
                            part.currentUsedToday > 0 && 'text-emerald-700 dark:text-emerald-300',
                          )}
                        >
                          {part.currentUsedToday}
                        </span>
                        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-muted">
                          used
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(part)}
                        aria-label={`Edit ${part.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:text-ink active:scale-95"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(part)}
                        aria-label={`Delete ${part.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:border-red-500/40 hover:text-red-600 active:scale-95 dark:hover:text-red-400"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black">Demo controls</h2>
            <p className="mt-0.5 text-xs text-muted">
              {teamSyncActive
                ? 'Team Sync is active. Disconnect in Team Sync before resetting local demo data.'
                : 'Restore the three demo vans, all 24 template lines, and sample shop orders.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            disabled={teamSyncActive}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-line bg-page px-4 text-xs font-bold text-muted transition hover:border-red-500/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:text-red-400"
          >
            <RotateCcw size={16} />
            Reset Demo Data
          </button>
        </div>
      </section>

      {editorOpen && (
        <PartEditorModal
          key={editingPart?.id ?? `new-${van.id}`}
          open={editorOpen}
          vanId={van.id}
          part={editingPart}
          onClose={() => {
            setEditorOpen(false)
            setEditingPart(null)
          }}
          onSaved={() => {
            setEditorOpen(false)
            setEditingPart(null)
          }}
          onToast={onToast}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this part?"
        description={
          deleteTarget
            ? `Remove “${deleteTarget.name}” from ${van.name}? Existing submitted orders are not changed.`
            : ''
        }
        confirmLabel="Delete Part"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={usageResetOpen}
        title="Clear tap counts?"
        description={`Reset today’s used counts for every part on ${van.name}? This does not send a restock list.`}
        confirmLabel="Clear Taps"
        tone="accent"
        busy={resettingUsage}
        onCancel={() => {
          if (!resettingUsage) setUsageResetOpen(false)
        }}
        onConfirm={() => void confirmUsageReset()}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset demo data?"
        description="This deletes all local vans, templates, orders, and queued sync changes on this device, then restores the original demo setup."
        confirmLabel="Reset Everything"
        busy={resetting}
        onCancel={() => {
          if (!resetting) setResetOpen(false)
        }}
        onConfirm={() => void confirmDemoReset()}
      />
    </div>
  )
}

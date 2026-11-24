import { useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Cable,
  Check,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Download,
  Droplets,
  FileSpreadsheet,
  Gauge,
  Menu,
  Minus,
  Monitor,
  PackageCheck,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Timer,
  Truck,
  Users,
  Waves,
  WifiOff,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../lib/utils'

const BASE = import.meta.env.BASE_URL
const APP_HREF = `${BASE}app/`
const DOWNLOAD_HREF = `${BASE}app.html`
const LICENSE_HREF = `${BASE}license.html`
const CHECKOUT_HREF = `${BASE}checkout.html`
const TRIAL_HREF =
  'https://github.com/Livnlgnd/trucktap/releases/download/v1.1.6/TruckTap-Setup-1.1.6.exe'
const GITHUB_HREF = 'https://github.com/Livnlgnd/trucktap'

function checkoutHref(planId: string): string {
  return `${CHECKOUT_HREF}?plan=${planId}`
}

const navLinks = [
  { label: 'Why TruckTap', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Demo', href: '#demo' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Team Sync', href: '#team-sync' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Download app', href: DOWNLOAD_HREF },
  { label: 'About', href: `${BASE}about.html` },
  { label: 'Support', href: `${BASE}support.html` },
]

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$99',
    tagline: 'For owner-operators and small crews.',
    vans: 'Up to 3 vans',
    featured: false,
    features: [
      '1 shop workstation',
      'Unlimited tech clickers',
      'Starter trade templates',
      'Shop pick-list + supplier CSV',
      '30-day local order history',
      '12 months of updates',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$199',
    tagline: 'The daily driver for growing multi-van shops.',
    vans: 'Up to 10 vans',
    featured: true,
    features: [
      '3 shop workstations',
      'Everything in Starter',
      'Custom van templates',
      'Local backup and restore',
      '12 months of updates',
      'Priority email support',
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: '$399',
    tagline: 'For larger shops and multi-location operations.',
    vans: 'Unlimited vans',
    featured: false,
    features: [
      'Site license',
      'Everything in Standard',
      'Shared trade templates',
      'Priority onboarding',
      '24 months of updates',
      'Priority support',
    ],
  },
]

const faqs = [
  {
    question: 'Does TruckTap work without internet?',
    answer:
      'Yes. The clicker, shop pick-list, templates, and local order data work completely offline. Every tap is saved directly to the device. Team Sync is optional and sends queued changes when a connection is available.',
  },
  {
    question: 'How much does TruckTap cost?',
    answer:
      'TruckTap is sold as a one-time license per shop. Starter is $99, Standard is $199, and Advanced is $399. Optional maintenance renewals are $49, $99, and $149 per year. The only recurring product is the optional $39/month Team Sync add-on.',
  },
  {
    question: 'Is there a required subscription?',
    answer:
      'No. You can buy TruckTap once and keep using the app forever. Updates are included for the term of your plan, and renewal is optional. Offline tapping, pick-lists, and CSV export are never locked behind Team Sync.',
  },
  {
    question: 'Do I need Team Sync?',
    answer:
      'Only if techs and the shop need to see the same board across different devices. A single shared shop tablet or desktop can run completely locally. Team Sync adds live phone-to-shop sync, accounts, roles, and join codes.',
  },
  {
    question: 'How do techs fix an accidental tap?',
    answer:
      'Every active tile has a dedicated -1 button, and holding the tile also subtracts one. No menu, no confirmation dialog, no slowing the crew down.',
  },
  {
    question: 'Can we use TruckTap on phones and desktop?',
    answer:
      'Yes. The field app is an installable PWA for iOS and Android, and the shop app runs in the browser, as a Windows desktop app, or on a shop tablet. The same account workspace follows you across devices when Team Sync is enabled.',
  },
  {
    question: 'What happens if we stop paying for updates?',
    answer:
      'The app keeps working. Maintenance is optional and only covers new updates and support. You can renew later without losing your local data.',
  },
  {
    question: 'Where is our data stored?',
    answer:
      'Local mode keeps everything in IndexedDB on your device. Team Sync stores the shared workspace in a hosted Postgres database so other devices can receive snapshots. You can disconnect Team Sync and keep a local copy.',
  },
]

const trades: Array<{
  icon: LucideIcon
  title: string
  body: string
  tone: string
}> = [
  {
    icon: Zap,
    title: 'Electrical & Controls',
    body: 'Breakers, GFCIs, wire nuts, connectors, tape, and switches.',
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    icon: Droplets,
    title: 'Plumbing & Drain',
    body: 'Push-fit fittings, P-traps, angle stops, rings, and leak-call stock.',
    tone: 'bg-cyan-50 text-cyan-700',
  },
  {
    icon: Building2,
    title: 'Apartment / Multifamily',
    body: 'Supply lines, flappers, filters, smoke detectors, and turnover fixes.',
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    icon: Wrench,
    title: 'General Maintenance',
    body: 'The everyday consumables that disappear before anyone notices.',
    tone: 'bg-orange-50 text-orange-700',
  },
]

function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href={BASE} className="flex items-center gap-2.5" aria-label="TruckTap home">
      <img
        src={`${BASE}icons/icon.svg`}
        alt=""
        width={42}
        height={42}
        className="h-10 w-10 rounded-xl"
      />
      <span>
        <span
          className={cn(
            'block text-lg font-black leading-none tracking-tight',
            light ? 'text-white' : 'text-slate-950',
          )}
        >
          TruckTap
        </span>
        <span
          className={cn(
            'mt-1 hidden text-[9px] font-black uppercase tracking-[0.18em] sm:block',
            light ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          Local-first van restock
        </span>
      </span>
    </a>
  )
}

function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#fffdf9]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#pricing"
            className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#c2410c] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#9a3412] sm:flex"
          >
            Buy TruckTap
            <ArrowUpRight size={16} />
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-[#fffdf9] px-4 py-4 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="min-h-12 border-b border-slate-200/70 py-3 text-base font-bold text-slate-700 last:border-0"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#pricing"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#c2410c] px-5 text-sm font-black text-white"
            >
              Buy TruckTap
              <ArrowUpRight size={17} />
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]" aria-hidden="true">
      <div className="absolute -inset-8 rounded-[3rem] bg-orange-200/40 blur-3xl" />
      <div className="relative rounded-[28px] border border-orange-100 bg-white p-2.5 shadow-[0_30px_80px_-30px_rgba(80,40,10,0.35)]">
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-[#f2f4ef]">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3.5 py-2.5">
            <span className="h-2 w-2 rounded-full bg-red-300" />
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            <div className="mx-auto flex max-w-[260px] flex-1 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[8px] font-bold text-slate-400">
              <ShieldCheck size={9} />
              trucktap.net
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[7px] font-black uppercase tracking-wide text-emerald-700">
              Saved locally
            </span>
          </div>

          <div className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c2410c] text-white">
                  <Truck size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black leading-none text-slate-900">
                    Van #101 - Mike
                  </p>
                  <p className="mt-1 text-[7px] font-bold uppercase tracking-wider text-slate-500">
                    Field clicker
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-600 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white">
                Online
              </span>
            </div>

            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[8px] font-semibold text-slate-400">
              <Search size={11} />
              Search parts, SKU, or category
            </div>
            <div className="mt-2 flex gap-1.5">
              {['All', 'Wire', 'Breakers', 'Hardware'].map((label, index) => (
                <span
                  key={label}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[7px] font-black',
                    index === 0
                      ? 'bg-[#c2410c] text-white'
                      : 'border border-slate-200 bg-white text-slate-500',
                  )}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MockTile
                icon={PlugZap}
                name="GFCI Outlet 20A White"
                sku="OUT-GFCI20W"
                tone="bg-amber-50 text-amber-700"
                used={2}
              />
              <MockTile
                icon={Zap}
                name="20A Single-Pole Breaker"
                sku="BRK-20SP"
                tone="bg-amber-50 text-amber-700"
              />
              <MockTile
                icon={Cable}
                name="Red Wire Nuts (Bag/10)"
                sku="WN-RED-10"
                tone="bg-sky-50 text-sky-700"
                used={1}
              />
              <MockTile
                icon={Waves}
                name='1/2" SharkBite Coupling'
                sku="SHK-BR-12"
                tone="bg-cyan-50 text-cyan-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white/90 px-3 py-2.5 sm:px-4">
            <div>
              <p className="text-[10px] font-black text-slate-900">
                3 parts marked used
              </p>
              <p className="mt-0.5 text-[7px] font-semibold text-slate-400">
                Van #101 - Mike
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-lg bg-[#c2410c] px-2.5 py-2 text-[7px] font-black uppercase tracking-wide text-white">
              <Send size={10} />
              Send restock list
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-7 -left-3 hidden w-[230px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:-left-8 sm:block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-[#c2410c]" />
            <p className="text-[9px] font-black text-slate-900">Shop pick-list</p>
          </div>
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[6px] font-black uppercase text-amber-700">
            Van 101
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 rounded-full bg-emerald-500" />
        </div>
        <div className="mt-2 space-y-1">
          {['GFCI Outlet · ×2', '20A Breaker · ×2'].map((item, index) => (
            <div
              key={item}
              className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1.5"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-emerald-600 text-white">
                <Check size={9} strokeWidth={3} />
              </span>
              <span
                className={cn(
                  'text-[7px] font-bold text-slate-600',
                  index === 0 && 'line-through',
                )}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -right-2 top-16 hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl sm:-right-6 sm:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Users size={14} />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-900">Team Sync</p>
            <p className="mt-0.5 text-[7px] font-semibold text-slate-400">
              3 devices up to date
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockTile({
  icon: Icon,
  name,
  sku,
  tone,
  used,
}: {
  icon: LucideIcon
  name: string
  sku: string
  tone: string
  used?: number
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border bg-white p-2',
        used ? 'border-emerald-400/70 bg-emerald-50/30' : 'border-slate-200',
      )}
    >
      {used && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[6px] font-black text-white">
          USED: {used}
        </span>
      )}
      <div
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md',
          tone,
        )}
      >
        <Icon size={14} />
      </div>
      <p className="mt-2 line-clamp-2 text-[8px] font-black leading-tight text-slate-900">
        {name}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[5px] font-bold uppercase tracking-wide text-slate-400">
          {sku}
        </span>
        <span className="flex h-4 w-4 items-center justify-center rounded border border-slate-200 text-slate-400">
          <Minus size={7} />
        </span>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#fffdf9]">
      <div className="pointer-events-none absolute -left-40 top-0 h-[540px] w-[540px] rounded-full bg-orange-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-20 h-[620px] w-[620px] rounded-full bg-amber-100/40 blur-3xl" />
      <div className="landing-dot-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-32">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#9a3412] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />
              Local-first · Team Sync optional
            </div>
            <h1 className="mt-6 max-w-[650px] text-[3.25rem] font-black leading-[0.96] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.6rem]">
              Restock the van.
              <span className="block text-[#c2410c]">Not the clipboard.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              TruckTap is the glove-friendly restock clicker for field service
              teams. Techs tap what they used. The shop gets a live pick-list and
              a clean supplier order — online or off the grid.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#pricing"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#c2410c] px-6 text-sm font-black text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)] transition hover:bg-[#9a3412]"
              >
                Buy TruckTap
                <ArrowRight size={18} />
              </a>
              <a
                href={TRIAL_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                <Download size={18} />
                Windows free trial
              </a>
              <a
                href={DOWNLOAD_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-6 text-sm font-black text-[#9a3412] transition hover:bg-orange-100"
              >
                Get the phone app
              </a>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              One-time licenses from <span className="font-black text-slate-800">$99</span>
              <span className="mx-1.5 text-slate-300">·</span>
              14-day free trial · No account required
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                Works offline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                Desktop + PWA
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                No per-tech fees
              </span>
            </div>
          </div>
          <HeroPreview />
        </div>
      </div>
    </section>
  )
}

function LogoStrip() {
  return (
    <section className="border-y border-slate-200 bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-center sm:px-6 lg:flex-row lg:px-8 lg:text-left">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          Built for the people keeping buildings running
        </p>
        <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-sm font-black text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Zap size={15} className="text-amber-500" /> Electrical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Droplets size={15} className="text-cyan-500" /> Plumbing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 size={15} className="text-violet-500" /> Multifamily
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wrench size={15} className="text-slate-500" /> Maintenance
          </span>
        </div>
      </div>
    </section>
  )
}

function FeatureSection() {
  const cards = [
    {
      icon: WifiOff,
      title: 'Works in dead zones',
      body: 'Basements, parking garages, mechanical rooms, rural calls. Every tap saves to IndexedDB immediately — no signal required.',
      accent: 'bg-orange-50 text-[#c2410c]',
    },
    {
      icon: WifiOff,
      title: 'Built for gloves',
      body: 'Minimum 64px action targets, one-handed layout, bold contrast, and haptic feedback. Tap +1 or hold to undo without opening a menu.',
      accent: 'bg-emerald-50 text-emerald-700',
    },
    {
      icon: ClipboardCheck,
      title: 'The shop gets a real list',
      body: 'No texts, no paper, no end-of-day scramble. A live pick-list, check-off flow, and consolidated supplier CSV are ready to go.',
      accent: 'bg-sky-50 text-sky-700',
    },
  ]

  return (
    <section id="features" className="scroll-mt-24 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
            Why TruckTap
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
            Built for the real job.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            A clipboard can survive a little rain. Your restock process should
            survive a basement with no bars.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, body, accent }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-[#fffdf9] p-5 shadow-sm"
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl',
                  accent,
                )}
              >
                <Icon size={22} />
              </div>
              <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ClipboardList,
              title: 'Job / unit tags',
              body: 'Attach the work order to every list.',
            },
            {
              icon: Gauge,
              title: 'Par levels',
              body: 'Keep the right stock on every board.',
            },
            {
              icon: FileSpreadsheet,
              title: 'Supplier CSV',
              body: 'One clean order across all vans.',
            },
            {
              icon: Timer,
              title: 'Fast reset',
              body: 'Send once and start the next shift clean.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <Icon size={17} className="mt-0.5 shrink-0 text-[#c2410c]" />
              <div>
                <p className="text-sm font-black text-slate-900">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Tap what the van used',
      body: 'Pick the van, add a job tag if you have one, and tap the parts. The count saves instantly and each tap has a built-in hold-to-undo.',
      icon: Zap,
    },
    {
      number: '02',
      title: 'Send the restock list',
      body: 'Review the tapped parts in one quick drawer, confirm, and the list lands on the shop board. Tap counts reset for the next shift.',
      icon: Send,
    },
    {
      number: '03',
      title: 'Shop picks and closes out',
      body: 'The warehouse checks off each line, marks the van restocked, and exports a consolidated supplier order when stock is low.',
      icon: PackageCheck,
    },
  ]

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-b border-slate-200 bg-[#f7f8f3]"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
              From dirty hands to a clean restock list.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              The whole loop is designed for the last ten minutes of a shift,
              not for a workstation in the office.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Cloud size={17} className="text-[#c2410c]" />
                Local by default
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Taps commit locally first. If Team Sync is on, queued changes
                follow when the device finds a connection. The workflow never
                waits on a spinner.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map(({ number, title, body, icon: Icon }) => (
              <article
                key={number}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1e7] text-[#c2410c]">
                    <Icon size={19} />
                  </span>
                  <span className="mt-3 h-full min-h-8 border-l border-dashed border-orange-200" />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">
                    Step {number}
                  </span>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TwoSides() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
            One app · two sides
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
            The field and the shop finally see the same list.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-3xl border border-orange-200/70 bg-[#fff8f1] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-orange-200/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c2410c] text-white">
                  <Truck size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">
                    For the technician
                  </p>
                  <h3 className="text-xl font-black text-slate-950">
                    Done before the drive home.
                  </h3>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'Tap +1 or hold to undo',
                  'Search, filter, and count in seconds',
                  'Job tag travels with the list',
                  'Works with no signal',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm font-semibold text-slate-700"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#c2410c] shadow-sm">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#c2410c]">
                  <Smartphone size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">
                    Add to Home Screen
                  </p>
                  <p className="text-[11px] text-slate-500">
                    iOS, Android, or a shop tablet.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#111820] p-6 text-white sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">
                    For the shop
                  </p>
                  <h3 className="text-xl font-black">Load the truck, not a spreadsheet.</h3>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  'Live pending-van dashboard',
                  'Check off lines as they load',
                  'One consolidated supplier order',
                  'CSV export in one click',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm font-semibold text-slate-200"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-400/15 text-orange-300">
                  <Monitor size={18} />
                </div>
                <div>
                  <p className="text-xs font-black">Desktop, tablet, or browser</p>
                  <p className="text-[11px] text-slate-400">
                    One shop board for the whole team.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function Trades() {
  return (
    <section className="border-b border-slate-200 bg-[#f7f8f3]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
              Trades & templates
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Preloaded for the stock you actually carry.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Load a starter board in one tap, then edit every part, SKU, icon,
              and par level to match your trucks.
            </p>
          </div>
          <a
            href={`${APP_HREF}`}
            className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[#c2410c] hover:text-[#9a3412]"
          >
            Explore the templates
            <ArrowRight size={16} />
          </a>
        </div>
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trades.map(({ icon: Icon, title, body, tone }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl',
                  tone,
                )}
              >
                <Icon size={21} />
              </div>
              <h3 className="mt-4 text-base font-black text-slate-950">
                {title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DemoSection() {
  return (
    <section
      id="demo"
      className="scroll-mt-24 border-b border-slate-200 bg-[#f7f8f3]"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
              Product demo
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
              See the whole loop in 28 seconds.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              One tech taps on a phone. The shop gets the list. Every part stays
              accounted for — on the device, without an account, and without a
              signal.
            </p>

            <ul className="mt-7 grid max-w-xl gap-3">
              {[
                'Set up a van and load a trade template.',
                'Tap each part you used; every tap saves offline.',
                'Send one list and let the shop pick it.',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm font-semibold text-slate-700"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#pricing"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#c2410c] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#9a3412]"
              >
                Buy TruckTap
                <ArrowRight size={17} />
              </a>
              <a
                href={DOWNLOAD_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              >
                Get the phone app
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[360px]">
            <div className="rounded-[2.5rem] border border-slate-800 bg-slate-950 p-2.5 shadow-[0_40px_100px_-35px_rgba(15,23,42,0.65)]">
              <div className="aspect-[9/16] overflow-hidden rounded-[2rem] bg-black">
                <video
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  muted
                  loop
                  preload="metadata"
                  poster={`${BASE}demo/trucktap-demo-poster.jpg`}
                  aria-label="TruckTap product demo"
                >
                  <source
                    src={`${BASE}demo/trucktap-demo-9x16.mp4`}
                    type="video/mp4"
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              9:16 demo · 28 seconds
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function TeamSyncSection() {
  return (
    <section
      id="team-sync"
      className="scroll-mt-24 overflow-hidden bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#101820] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">
                <Cloud size={13} />
                Optional add-on
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                The shop sees the list before the truck leaves.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                Team Sync connects techs and the shop across devices without
                changing the local-first workflow. Join a workspace with a short
                code, manage roles, and let queued taps sync when there is
                signal.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-300">
                {[
                  'Phone → shop live sync',
                  'Owner, shop & tech roles',
                  'Join codes for the crew',
                  'Offline queueing included',
                ].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400" />
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={APP_HREF}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-black text-slate-950 transition hover:bg-orange-400"
                >
                  Try Team Sync
                  <ArrowRight size={17} />
                </a>
                <p className="text-sm font-bold text-slate-400">
                  <span className="text-2xl font-black text-white">$39</span>/month
                  <span className="ml-2 text-xs font-semibold">
                    Optional · cancel anytime
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-slate-950">
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black">Northside Electric</p>
                    <p className="text-[9px] font-semibold text-slate-400">
                      Team workspace
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-300">
                  Synced
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Vans', '3'],
                  ['Shop seats', '3'],
                  ['Pending vans', '2'],
                  ['Queued taps', '0'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <RefreshCw size={15} className="text-orange-300" />
                <div>
                  <p className="text-[10px] font-black">Workspace is up to date</p>
                  <p className="text-[9px] text-slate-500">
                    3 devices · just now
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-y border-slate-200 bg-[#f7f8f3]"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
            Buy once. Own it.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            One-time licenses for the whole shop — not per technician. Every plan
            includes the offline clicker, shop pick-list, templates, and local
            CSV export.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm',
                plan.featured
                  ? 'border-[#c2410c] shadow-[0_20px_55px_-25px_rgba(194,65,12,0.45)] ring-2 ring-orange-500/10'
                  : 'border-slate-200',
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#c2410c] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-sm">
                  Most popular
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {plan.vans}
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    {plan.name}
                  </h3>
                </div>
                {plan.featured && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-[#c2410c]">
                    <Zap size={17} />
                  </span>
                )}
              </div>
              <p className="mt-1 min-h-10 text-sm leading-relaxed text-slate-500">
                {plan.tagline}
              </p>
              <div className="mt-6 flex items-end gap-1.5">
                <span className="text-5xl font-black tracking-[-0.06em] text-slate-950">
                  {plan.price}
                </span>
                <span className="pb-1.5 text-xs font-bold text-slate-500">
                  one-time
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                Per shop · no mandatory subscription
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm font-semibold text-slate-700"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={checkoutHref(plan.id)}
                className={cn(
                  'mt-7 flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-black transition',
                  plan.featured
                    ? 'bg-[#c2410c] text-white hover:bg-[#9a3412]'
                    : 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                Buy {plan.name}
                <ArrowRight size={16} />
              </a>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-6xl rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-slate-500">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              Every plan includes a 14-day free trial, offline tapping, supplier
              CSV, local backups, and desktop + PWA access. Optional maintenance
              renewals are $49–$149/year and are never required to keep using the
              app. Prices in USD.
            </p>
            <a
              href="#faq"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black text-[#c2410c] hover:text-[#9a3412]"
            >
              Read license FAQ
              <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c2410c]">
                  Team Sync add-on
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">
                  Live phone-to-shop sync.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Optional for teams that need more than one shared device. Join
                  codes, roles, queued sync, and a shared shop board.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black text-slate-950">$39</p>
                <p className="text-[10px] font-bold text-slate-400">/month</p>
              </div>
            </div>
            <a
              href={APP_HREF}
              className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
            >
              Try Team Sync
              <ArrowRight size={14} />
            </a>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c2410c]">
                  Maintenance
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">
                  Updates. Optional.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Starter includes 12 months of updates, Standard includes 12,
                  and Advanced includes 24. Renew only when you want the next
                  round; the app keeps working without it.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-black text-slate-950">$49+</p>
                <p className="text-[10px] font-bold text-slate-400">/year</p>
              </div>
            </div>
            <a
              href="#faq"
              className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              How licensing works
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#c2410c]">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
            The short version.
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Answers for the shop owner, the warehouse runner, and the tech
            standing in a mechanical room.
          </p>
        </div>
        <div className="mt-9 divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-black text-slate-900">
                {faq.question}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45">
                  <Plus size={15} />
                </span>
              </summary>
              <p className="max-w-3xl pb-5 pr-10 text-sm leading-relaxed text-slate-600">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="bg-[#c2410c]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#9a3412] px-6 py-12 text-white shadow-2xl sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">
                Ready when the truck is
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Put the clipboard down.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-orange-100">
                Open the app right now, or install the Windows desktop build.
                Local mode is free to explore; one-time licenses start at $99.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href={APP_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-black text-[#9a3412] shadow-sm transition hover:bg-orange-50"
              >
                Open TruckTap
                <ArrowRight size={17} />
              </a>
              <a
                href={DOWNLOAD_HREF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-black text-white transition hover:bg-white/15"
              >
                <Download size={17} />
                Download for Windows
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-[#101820] text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              Local-first van restock for field service teams. Tap, send, pick,
              close out.
            </p>
            <p className="mt-5 text-xs font-semibold text-slate-500">
              Made for the people who keep the buildings running.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Product
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
              <a href={APP_HREF} className="hover:text-white">
                Open web app
              </a>
              <a href={DOWNLOAD_HREF} className="hover:text-white">
                Download &amp; install
              </a>
              <a href={LICENSE_HREF} className="hover:text-white">
                License lookup
              </a>
              <a href="#pricing" className="hover:text-white">
                Pricing
              </a>
              <a href="#team-sync" className="hover:text-white">
                Team Sync
              </a>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Company
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
              <a href={`${BASE}about.html`} className="hover:text-white">
                About
              </a>
              <a href={`${BASE}support.html`} className="hover:text-white">
                Support
              </a>
              <a href={GITHUB_HREF} className="hover:text-white">
                GitHub
              </a>
              <a
                href={`${GITHUB_HREF}/blob/main/docs/BACKEND.md`}
                className="hover:text-white"
              >
                Backend docs
              </a>
              <a
                href={`${GITHUB_HREF}/blob/main/docs/PRICING.md`}
                className="hover:text-white"
              >
                License details
              </a>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Install
            </p>
            <p className="mt-3 text-sm leading-relaxed">
              Add TruckTap to your home screen from the web app. The desktop
              build is available for Windows.
            </p>
            <a
              href={APP_HREF}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-orange-300 hover:text-orange-200"
            >
              Launch the app
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-[11px] font-semibold text-slate-500 sm:flex-row">
          <p>© 2026 TruckTap. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <a href={`${BASE}privacy.html`} className="hover:text-white">
              Privacy
            </a>
            <a href={`${BASE}terms.html`} className="hover:text-white">
              Terms
            </a>
            <a href={LICENSE_HREF} className="hover:text-white">
              License lookup
            </a>
            <span>Local-first · Desktop + PWA</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="landing-root min-h-screen overflow-x-hidden bg-[#fffdf9] text-slate-900">
      <Header />
      <main>
        <Hero />
        <LogoStrip />
        <FeatureSection />
        <HowItWorks />
        <DemoSection />
        <TwoSides />
        <Trades />
        <TeamSyncSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

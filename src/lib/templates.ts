import type { TemplatePart, TradePreset } from '../types'

export interface CategoryMeta {
  id: string
  name: string
  filterLabel: string
  iconName: string
  iconClass: string
  dotClass: string
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'wire',
    name: 'Wire & Connectors',
    filterLabel: 'Wire & Connectors',
    iconName: 'Cable',
    iconClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    dotClass: 'bg-sky-500',
  },
  {
    id: 'breakers',
    name: 'Breakers & Boxes',
    filterLabel: 'Breakers & Boxes',
    iconName: 'Zap',
    iconClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    dotClass: 'bg-amber-500',
  },
  {
    id: 'hardware',
    name: 'Hardware & Fasteners',
    filterLabel: 'Hardware',
    iconName: 'Wrench',
    iconClass: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    dotClass: 'bg-violet-500',
  },
  {
    id: 'plumbing',
    name: 'Plumbing/Fixtures',
    filterLabel: 'Plumbing',
    iconName: 'Droplets',
    iconClass: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
    dotClass: 'bg-cyan-500',
  },
]

export const CATEGORY_NAMES = CATEGORIES.map((category) => category.name)

export function getCategoryMeta(name: string): CategoryMeta {
  return (
    CATEGORIES.find((category) => category.name === name) ?? {
      id: 'other',
      name,
      filterLabel: name,
      iconName: 'Package',
      iconClass: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
      dotClass: 'bg-slate-500',
    }
  )
}

export const DEFAULT_TEMPLATE_NAME = 'Electrical & General Maintenance'

export const DEFAULT_TEMPLATE: TemplatePart[] = [
  // Wire & Connectors
  {
    name: 'Red Wire Nuts (Bag/10)',
    sku: 'WN-RED-10',
    category: 'Wire & Connectors',
    parLevel: 20,
    iconName: 'Cable',
  },
  {
    name: 'Yellow Wire Nuts (Bag/10)',
    sku: 'WN-YEL-10',
    category: 'Wire & Connectors',
    parLevel: 15,
    iconName: 'Cable',
  },
  {
    name: '12/2 Romex Cable (25 ft)',
    sku: 'RX-122-25',
    category: 'Wire & Connectors',
    parLevel: 2,
    iconName: 'Unplug',
  },
  {
    name: '1/2" EMT Compression Connector',
    sku: 'EMT-C05',
    category: 'Wire & Connectors',
    parLevel: 25,
    iconName: 'Wrench',
  },
  {
    name: 'Wago Lever Nuts 3-Port (10)',
    sku: 'WAGO-3',
    category: 'Wire & Connectors',
    parLevel: 10,
    iconName: 'Link2',
  },
  {
    name: 'Electrical Tape (Black)',
    sku: 'TAPE-BLK',
    category: 'Wire & Connectors',
    parLevel: 12,
    iconName: 'Disc3',
  },

  // Breakers & Boxes
  {
    name: '20A Single-Pole Breaker',
    sku: 'BRK-20SP',
    category: 'Breakers & Boxes',
    parLevel: 10,
    iconName: 'Zap',
  },
  {
    name: '15A Single-Pole Breaker',
    sku: 'BRK-15SP',
    category: 'Breakers & Boxes',
    parLevel: 10,
    iconName: 'Zap',
  },
  {
    name: '20A GFCI Breaker',
    sku: 'BRK-20GFCI',
    category: 'Breakers & Boxes',
    parLevel: 4,
    iconName: 'ShieldCheck',
  },
  {
    name: 'GFCI Outlet 20A White',
    sku: 'OUT-GFCI20W',
    category: 'Breakers & Boxes',
    parLevel: 8,
    iconName: 'PlugZap',
  },
  {
    name: '4" Square Junction Box',
    sku: 'JB-4SQ',
    category: 'Breakers & Boxes',
    parLevel: 12,
    iconName: 'Box',
  },
  {
    name: 'Weatherproof Outlet Cover',
    sku: 'WP-COVER',
    category: 'Breakers & Boxes',
    parLevel: 6,
    iconName: 'Layers',
  },

  // Hardware & Fasteners
  {
    name: '#10 x 1-1/2" Wood Screws (100)',
    sku: 'SCR-WOOD-100',
    category: 'Hardware & Fasteners',
    parLevel: 3,
    iconName: 'Bolt',
  },
  {
    name: '1/4" x 2" Hex Bolts (25)',
    sku: 'BLT-HEX-25',
    category: 'Hardware & Fasteners',
    parLevel: 5,
    iconName: 'Bolt',
  },
  {
    name: 'Nylon Wire Clips (50)',
    sku: 'CLIP-NYL-50',
    category: 'Hardware & Fasteners',
    parLevel: 4,
    iconName: 'Paperclip',
  },
  {
    name: 'Heavy-Duty Duct Tape',
    sku: 'TAPE-DUCT',
    category: 'Hardware & Fasteners',
    parLevel: 4,
    iconName: 'Disc3',
  },
  {
    name: '8" Cable Ties (100)',
    sku: 'TIE-8-100',
    category: 'Hardware & Fasteners',
    parLevel: 4,
    iconName: 'Link2',
  },
  {
    name: 'AA Batteries (4-pack)',
    sku: 'BAT-AA-4',
    category: 'Hardware & Fasteners',
    parLevel: 6,
    iconName: 'Battery',
  },

  // Plumbing/Fixtures
  {
    name: '1/2" SharkBite Coupling',
    sku: 'SHK-BR-12',
    category: 'Plumbing/Fixtures',
    parLevel: 6,
    iconName: 'Waves',
  },
  {
    name: '3/4" PEX Elbow (10)',
    sku: 'PEX-ELB-34',
    category: 'Plumbing/Fixtures',
    parLevel: 5,
    iconName: 'Workflow',
  },
  {
    name: 'Teflon Tape (3-pack)',
    sku: 'TEFLON-3',
    category: 'Plumbing/Fixtures',
    parLevel: 10,
    iconName: 'Disc3',
  },
  {
    name: '1-1/2" P-Trap Kit',
    sku: 'PTRAP-15',
    category: 'Plumbing/Fixtures',
    parLevel: 4,
    iconName: 'Filter',
  },
  {
    name: '1/2" Angle Stop',
    sku: 'STOP-12',
    category: 'Plumbing/Fixtures',
    parLevel: 6,
    iconName: 'Gauge',
  },
  {
    name: 'Wax Ring (No-Seal)',
    sku: 'WAX-RING',
    category: 'Plumbing/Fixtures',
    parLevel: 4,
    iconName: 'CircleDot',
  },
]

export const TRADE_PRESETS: TradePreset[] = [
  {
    id: 'electrical',
    name: 'Electrical & Controls',
    description:
      'Breakers, wire nuts, connectors, GFCIs, tape, and switches for service calls.',
    iconName: 'Zap',
    parts: [
      {
        name: '20A Single-Pole Breaker',
        sku: 'BRK-20SP',
        category: 'Breakers & Boxes',
        parLevel: 10,
        iconName: 'Zap',
      },
      {
        name: '15A Single-Pole Breaker',
        sku: 'BRK-15SP',
        category: 'Breakers & Boxes',
        parLevel: 10,
        iconName: 'Zap',
      },
      {
        name: '20A GFCI Breaker',
        sku: 'BRK-20GFCI',
        category: 'Breakers & Boxes',
        parLevel: 4,
        iconName: 'ShieldCheck',
      },
      {
        name: 'GFCI Outlet 20A White',
        sku: 'OUT-GFCI20W',
        category: 'Breakers & Boxes',
        parLevel: 8,
        iconName: 'PlugZap',
      },
      {
        name: 'Red Wire Nuts (Bag/10)',
        sku: 'WN-RED-10',
        category: 'Wire & Connectors',
        parLevel: 20,
        iconName: 'Cable',
      },
      {
        name: 'Yellow Wire Nuts (Bag/10)',
        sku: 'WN-YEL-10',
        category: 'Wire & Connectors',
        parLevel: 15,
        iconName: 'Cable',
      },
      {
        name: '1/2" EMT Compression Connector',
        sku: 'EMT-C05',
        category: 'Wire & Connectors',
        parLevel: 25,
        iconName: 'Wrench',
      },
      {
        name: '12/2 Romex Cable (25 ft)',
        sku: 'RX-122-25',
        category: 'Wire & Connectors',
        parLevel: 2,
        iconName: 'Unplug',
      },
      {
        name: 'Electrical Tape (Black)',
        sku: 'TAPE-BLK',
        category: 'Wire & Connectors',
        parLevel: 12,
        iconName: 'Disc3',
      },
      {
        name: '3-Way Toggle Switch',
        sku: 'SW-3WAY',
        category: 'Wire & Connectors',
        parLevel: 8,
        iconName: 'Timer',
      },
      {
        name: '4" Square Junction Box',
        sku: 'JB-4SQ',
        category: 'Breakers & Boxes',
        parLevel: 12,
        iconName: 'Box',
      },
      {
        name: 'Wago Lever Nuts 3-Port (10)',
        sku: 'WAGO-3',
        category: 'Wire & Connectors',
        parLevel: 10,
        iconName: 'Link2',
      },
      {
        name: 'Weatherproof Outlet Cover',
        sku: 'WP-COVER',
        category: 'Breakers & Boxes',
        parLevel: 6,
        iconName: 'Layers',
      },
      {
        name: 'Nylon Wire Clips (50)',
        sku: 'CLIP-NYL-50',
        category: 'Hardware & Fasteners',
        parLevel: 4,
        iconName: 'Paperclip',
      },
    ],
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Drain',
    description:
      'Push-fit fittings, P-traps, angle stops, rings, and the leak-call essentials.',
    iconName: 'Droplets',
    parts: [
      {
        name: '1/2" SharkBite Coupling',
        sku: 'SHK-BR-12',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Waves',
      },
      {
        name: '3/4" SharkBite Coupling',
        sku: 'SHK-BR-34',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Waves',
      },
      {
        name: '1-1/2" P-Trap Kit',
        sku: 'PTRAP-15',
        category: 'Plumbing/Fixtures',
        parLevel: 4,
        iconName: 'Filter',
      },
      {
        name: 'Wax Ring (No-Seal)',
        sku: 'WAX-RING',
        category: 'Plumbing/Fixtures',
        parLevel: 4,
        iconName: 'CircleDot',
      },
      {
        name: 'Teflon Tape (3-pack)',
        sku: 'TEFLON-3',
        category: 'Plumbing/Fixtures',
        parLevel: 10,
        iconName: 'Disc3',
      },
      {
        name: '1/2" Angle Stop',
        sku: 'STOP-12',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Gauge',
      },
      {
        name: '3/4" PEX Elbow (10)',
        sku: 'PEX-ELB-34',
        category: 'Plumbing/Fixtures',
        parLevel: 5,
        iconName: 'Workflow',
      },
      {
        name: '1/2" PEX Crimp Rings (25)',
        sku: 'PEX-CRIMP-12',
        category: 'Plumbing/Fixtures',
        parLevel: 4,
        iconName: 'CircleDot',
      },
      {
        name: "Plumber's Putty",
        sku: 'PUTTY-PLUMB',
        category: 'Plumbing/Fixtures',
        parLevel: 4,
        iconName: 'Package',
      },
      {
        name: '2" ABS Coupling',
        sku: 'ABS-CPL-2',
        category: 'Plumbing/Fixtures',
        parLevel: 5,
        iconName: 'Link2',
      },
      {
        name: 'Braided Supply Line (20")',
        sku: 'SUP-BRAID-20',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Cable',
      },
      {
        name: 'Closet Bolt Set',
        sku: 'BOLT-CLOSET',
        category: 'Plumbing/Fixtures',
        parLevel: 4,
        iconName: 'Bolt',
      },
    ],
  },
  {
    id: 'multifamily',
    name: 'Apartment / Multifamily',
    description:
      'Turnover and work-order stock for units: supply lines, flappers, filters, and fixes.',
    iconName: 'Building2',
    parts: [
      {
        name: 'Braided Supply Line (20")',
        sku: 'SUP-BRAID-20',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Cable',
      },
      {
        name: 'Toilet Flapper Valve (3")',
        sku: 'FLAP-3',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Toilet',
      },
      {
        name: 'Smoke Detector (10-Year Battery)',
        sku: 'SMOKE-10YR',
        category: 'Breakers & Boxes',
        parLevel: 4,
        iconName: 'Siren',
      },
      {
        name: 'Spring Door Stop',
        sku: 'STOP-DOOR-SP',
        category: 'Hardware & Fasteners',
        parLevel: 8,
        iconName: 'DoorClosed',
      },
      {
        name: 'Blind Bracket (2")',
        sku: 'BLIND-BRK-2',
        category: 'Hardware & Fasteners',
        parLevel: 6,
        iconName: 'PanelsTopLeft',
      },
      {
        name: 'A/C Filter 20x20x1',
        sku: 'FILTER-2020',
        category: 'Hardware & Fasteners',
        parLevel: 6,
        iconName: 'Wind',
      },
      {
        name: 'LED A19 Bulbs (4-pack)',
        sku: 'LED-A19-4',
        category: 'Breakers & Boxes',
        parLevel: 3,
        iconName: 'Lightbulb',
      },
      {
        name: 'GFCI Outlet 20A White',
        sku: 'OUT-GFCI20W',
        category: 'Breakers & Boxes',
        parLevel: 8,
        iconName: 'PlugZap',
      },
      {
        name: '1/2" SharkBite Coupling',
        sku: 'SHK-BR-12',
        category: 'Plumbing/Fixtures',
        parLevel: 6,
        iconName: 'Waves',
      },
      {
        name: 'Teflon Tape (3-pack)',
        sku: 'TEFLON-3',
        category: 'Plumbing/Fixtures',
        parLevel: 10,
        iconName: 'Disc3',
      },
      {
        name: '9V Battery',
        sku: 'BAT-9V',
        category: 'Hardware & Fasteners',
        parLevel: 4,
        iconName: 'Battery',
      },
      {
        name: 'Drywall Patch Kit',
        sku: 'PATCH-DW',
        category: 'Hardware & Fasteners',
        parLevel: 4,
        iconName: 'Hammer',
      },
    ],
  },
]

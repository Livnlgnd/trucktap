import { useCallback, useEffect, useRef, useState } from 'react'
import type { PartItem, Van } from '../types'

export const TUTORIAL_DONE_KEY = 'hasCompletedTutorial'

const DEMO_VAN: Van = {
  id: 'tutorial-van',
  name: 'Demo Van 12',
  techName: 'Tutorial',
  number: '12',
}

const DEMO_PARTS: PartItem[] = [
  {
    id: 'tutorial-part-straps',
    vanId: DEMO_VAN.id,
    name: '1/2" EMT Conduit Straps',
    sku: 'EMT-STRAP-12',
    category: 'Wire & Connectors',
    parLevel: 25,
    currentUsedToday: 2,
    iconName: 'Cable',
    barcode: '0123456789012',
  },
  {
    id: 'tutorial-part-wirenuts',
    vanId: DEMO_VAN.id,
    name: 'Red/Yellow Wire Nuts (100ct)',
    sku: 'WN-RY-100',
    category: 'Wire & Connectors',
    parLevel: 40,
    currentUsedToday: 5,
    iconName: 'Cable',
    barcode: '0123456789013',
  },
  {
    id: 'tutorial-part-breaker',
    vanId: DEMO_VAN.id,
    name: '20A Single-Pole Breaker',
    sku: 'BRK-20SP',
    category: 'Breakers & Boxes',
    parLevel: 12,
    currentUsedToday: 1,
    iconName: 'Zap',
    barcode: '0123456789014',
  },
  {
    id: 'tutorial-part-pvc',
    vanId: DEMO_VAN.id,
    name: '3/4" PVC Male Adapter',
    sku: 'PVC-MA-34',
    category: 'Plumbing/Fixtures',
    parLevel: 18,
    currentUsedToday: 0,
    iconName: 'Droplets',
    barcode: '0123456789015',
  },
]

function hasCompleted(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_DONE_KEY) === 'true'
  } catch {
    return false
  }
}

export function useTutorialWalkthrough(ready: boolean, hasInventory: boolean) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(1)
  const [demoParts, setDemoParts] = useState<PartItem[]>(DEMO_PARTS)
  const autoStartedRef = useRef(false)

  const start = useCallback(() => {
    setDemoParts(DEMO_PARTS.map((part) => ({ ...part })))
    setStep(1)
    setActive(true)
  }, [])

  useEffect(() => {
    if (!ready || !hasInventory || autoStartedRef.current) return
    autoStartedRef.current = true
    if (!hasCompleted()) start()
  }, [hasInventory, ready, start])

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(TUTORIAL_DONE_KEY, 'true')
    } catch {
      // The walkthrough may reappear if storage is restricted.
    }
    setActive(false)
    setStep(1)
    setDemoParts(DEMO_PARTS.map((part) => ({ ...part })))
  }, [])

  const handleIncrement = useCallback(
    (partId: string) => {
      setDemoParts((parts) =>
        parts.map((part) =>
          part.id === partId
            ? { ...part, currentUsedToday: part.currentUsedToday + 1 }
            : part,
        ),
      )
      if (step === 1) setStep(2)
    },
    [step],
  )

  const handleDecrement = useCallback(
    (partId: string) => {
      setDemoParts((parts) =>
        parts.map((part) =>
          part.id === partId && part.currentUsedToday > 0
            ? { ...part, currentUsedToday: part.currentUsedToday - 1 }
            : part,
        ),
      )
      if (step === 2) setStep(3)
    },
    [step],
  )

  const handleDemoScan = useCallback(() => {
    setDemoParts((parts) => {
      if (parts.some((part) => part.id === 'tutorial-part-scanned')) return parts
      return [
        ...parts,
        {
          id: 'tutorial-part-scanned',
          vanId: DEMO_VAN.id,
          name: '20A Single-Pole Breaker',
          sku: '0123456789014',
          barcode: '0123456789014',
          category: 'Breakers & Boxes',
          parLevel: 12,
          currentUsedToday: 1,
          iconName: 'Zap',
        },
      ]
    })
    if (step === 3) setStep(4)
  }, [step])

  const acknowledgeStatus = useCallback(() => {
    if (step === 4) setStep(5)
  }, [step])

  return {
    active,
    step,
    demoVan: DEMO_VAN,
    demoParts,
    start,
    finish,
    handleIncrement,
    handleDecrement,
    handleDemoScan,
    acknowledgeStatus,
  }
}

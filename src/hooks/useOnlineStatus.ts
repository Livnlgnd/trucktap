import { useEffect, useState } from 'react'

const SIMULATE_OFFLINE_KEY = 'trucktap.simulate-offline'

function readSimulatedOffline(): boolean {
  try {
    return window.localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true'
  } catch {
    return false
  }
}

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [simulatedOffline, setSimulatedOffline] = useState(readSimulatedOffline)

  useEffect(() => {
    const markOnline = () => setBrowserOnline(true)
    const markOffline = () => setBrowserOnline(false)

    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)

    return () => {
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])

  const toggleSimulatedOffline = () => {
    setSimulatedOffline((current) => {
      const next = !current
      try {
        window.localStorage.setItem(SIMULATE_OFFLINE_KEY, String(next))
      } catch {
        // The in-memory toggle still works if storage is blocked.
      }
      return next
    })
  }

  return {
    browserOnline,
    simulatedOffline,
    isOnline: browserOnline && !simulatedOffline,
    toggleSimulatedOffline,
  }
}

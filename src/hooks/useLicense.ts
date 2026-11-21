import { useCallback, useEffect, useState } from 'react'
import {
  activateLicense,
  clearLicense,
  licenseCanUseApp,
  loadLicenseState,
  trialState,
  type TruckTapLicenseState,
} from '../lib/license'

export function useLicense(enabled: boolean) {
  const [state, setState] = useState<TruckTapLicenseState | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const next = await loadLicenseState()
    setState(next)
    setLoading(false)
    return next
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)

    loadLicenseState()
      .then((next) => {
        if (!cancelled) {
          setState(next)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(trialState('Could not read the local license state.'))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  const activate = useCallback(async (key: string) => {
    const next = await activateLicense(key)
    setState(next)
    setLoading(false)
    return next
  }, [])

  const remove = useCallback(async () => {
    clearLicense()
    return refresh()
  }, [refresh])

  return {
    state,
    loading,
    activate,
    remove,
    refresh,
    canUseApp: state ? licenseCanUseApp(state) : false,
  }
}

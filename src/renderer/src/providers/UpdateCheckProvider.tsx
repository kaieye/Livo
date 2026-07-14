import { useEffect, type PropsWithChildren } from 'react'
import { UpdatePrompt } from '../components/ui/UpdatePrompt'
import { useUpdateStore } from '../store/update-store'

const STARTUP_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export function UpdateCheckProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    let intervalId: number | null = null
    let cancelled = false
    const unsubscribeUpdateState = window.api.on('app:update-state', (state) =>
      useUpdateStore.getState().applyUpdateState(state),
    )

    void window.api.app
      .getVersion()
      .then((version) => {
        if (!cancelled) {
          useUpdateStore.getState().setCurrentVersion(version)
        }
      })
      .catch(() => {})

    const startupTimer = window.setTimeout(() => {
      void useUpdateStore.getState().checkForUpdates()
      intervalId = window.setInterval(() => {
        void useUpdateStore.getState().checkForUpdates()
      }, CHECK_INTERVAL_MS)
    }, STARTUP_DELAY_MS)

    return () => {
      cancelled = true
      unsubscribeUpdateState()
      window.clearTimeout(startupTimer)
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  return (
    <>
      {children}
      <UpdatePrompt />
    </>
  )
}

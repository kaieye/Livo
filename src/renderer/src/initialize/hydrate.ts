/**
 * Data hydration layer - loads data from backend into memory store before React renders.
 * This avoids blocking the UI with serial IPC calls during bootstrap.
 */

import { useSettingsStore } from '../store/settings-store'
import { useFeedStore } from '../store/feed-store'
import { useActionsStore } from '../store/actions-store'
import { useAuthStore } from '../store/auth-store'

export interface HydrateResult {
  settings: any
  feeds: any[]
  rules: any[]
  session: any | null
  timings: {
    settings: number
    feeds: number
    rules: number
    auth: number
    total: number
  }
}

/**
 * Load all critical application data from backend in parallel and write directly to stores.
 * This runs before React renders, so stores are pre-populated when components mount.
 */
export async function hydrateDataToMemory(): Promise<HydrateResult> {
  const startTime = performance.now()
  const timings = {
    settings: 0,
    feeds: 0,
    rules: 0,
    auth: 0,
    total: 0,
  }

  // Load all data in parallel to minimize startup time
  const [settingsResult, feedsResult, rulesResult, sessionResult] =
    await Promise.allSettled([
      // Settings
      (async () => {
        const start = performance.now()
        try {
          const settings = await window.api.settings.get()
          timings.settings = performance.now() - start
          return settings
        } catch (error) {
          console.error('[Hydrate] Failed to load settings:', error)
          timings.settings = performance.now() - start
          return null
        }
      })(),

      // Feeds
      (async () => {
        const start = performance.now()
        try {
          const feeds = await window.api.feeds.list()
          timings.feeds = performance.now() - start
          return feeds
        } catch (error) {
          console.error('[Hydrate] Failed to load feeds:', error)
          timings.feeds = performance.now() - start
          return []
        }
      })(),

      // Action rules (load from localStorage, not IPC)
      (async () => {
        const start = performance.now()
        try {
          // Actions are stored in localStorage, not backend
          // Just initialize the store
          timings.rules = performance.now() - start
          return []
        } catch (error) {
          console.error('[Hydrate] Failed to load action rules:', error)
          timings.rules = performance.now() - start
          return []
        }
      })(),

      // Auth session
      (async () => {
        const start = performance.now()
        try {
          const result = await window.api.auth.checkSession()
          timings.auth = performance.now() - start
          return result
        } catch (error) {
          // Session might not exist, this is not an error
          timings.auth = performance.now() - start
          return null
        }
      })(),
    ])

  // Extract values from Promise.allSettled results
  const settings =
    settingsResult.status === 'fulfilled' ? settingsResult.value : null
  const feeds = feedsResult.status === 'fulfilled' ? feedsResult.value : []
  const rules = rulesResult.status === 'fulfilled' ? rulesResult.value : []
  const sessionData =
    sessionResult.status === 'fulfilled' ? sessionResult.value : null

  // Write data directly to stores (bypassing actions to avoid side effects)
  if (settings) {
    useSettingsStore.setState({ settings, isLoaded: true })
  }

  if (feeds && feeds.length > 0) {
    useFeedStore.setState({ feeds, isLoading: false })
  }

  // Load action rules from localStorage (they handle their own hydration)
  useActionsStore.getState().loadRules()

  // Auth session check
  if (sessionData?.success && sessionData?.isValid && sessionData?.user) {
    useAuthStore.setState({
      user: sessionData.user,
      isAuthenticated: true,
      isSessionChecked: true,
      isLoading: false,
    })
  } else {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isSessionChecked: true,
      isLoading: false,
    })
  }

  timings.total = performance.now() - startTime

  console.log('[Hydrate] Data hydration complete:', {
    settings: !!settings,
    feedCount: feeds.length,
    ruleCount: rules.length,
    authenticated: sessionData?.success && sessionData?.isValid,
    timings,
  })

  return {
    settings,
    feeds,
    rules,
    session: sessionData,
    timings,
  }
}

const afterReadyCallbackQueue: Array<() => void> = []

let appReady = false

export function isAppReady(): boolean {
  return appReady
}

export function waitForAppReady(callback: () => void, delay = 0): void {
  const run = () => {
    if (delay > 0) {
      window.setTimeout(callback, delay)
      return
    }
    callback()
  }

  if (appReady) {
    run()
    return
  }

  afterReadyCallbackQueue.push(run)
}

export function applyAfterReadyCallbacks(): void {
  appReady = true
  const queued = afterReadyCallbackQueue.splice(
    0,
    afterReadyCallbackQueue.length,
  )
  for (const callback of queued) {
    callback()
  }
}

/**
 * 设置后台事件监听器 - 从 AppBootstrapProvider 迁移过来
 * 监听主进程的增量更新事件，优化数据同步性能
 */
export async function setupBackgroundEventListeners(): Promise<void> {
  if (!window.api?.on) return

  // 动态导入避免循环依赖
  const { useFeedStore } = await import('../store/feed-store')
  const { useEntryStore } = await import('../store/entry-store')
  const { buildHomeFeedLoadOptions } = await import('../lib/home-feed-scope')

  function reloadEntriesForCurrentScope() {
    const { selectedFeedId, activeView, feeds } = useFeedStore.getState()
    const { loadEntries } = useEntryStore.getState()
    void loadEntries(
      buildHomeFeedLoadOptions({ selectedFeedId, activeView, feeds }),
    )
  }

  // 监听 feeds 更新
  window.api.on('feeds:updated', (payload) => {
    console.log('[Queue] feeds:updated event:', payload)
    const { loadFeeds } = useFeedStore.getState()

    if (payload?.feedIds && payload.feedIds.length > 0) {
      const currentFeeds = useFeedStore.getState().feeds
      console.log('[Queue] Current feeds count:', currentFeeds.length)

      const needsFullReload = payload.feedIds.some(
        (id: string) => !currentFeeds.find((f) => f.id === id),
      )

      if (needsFullReload) {
        console.log('[Queue] Full reload needed (new feed detected)')
        loadFeeds()
      } else if (payload.feeds && payload.feeds.length > 0) {
        console.log(
          '[Queue] Partial update with',
          payload.feeds.length,
          'feeds',
        )
        useFeedStore.setState((state) => {
          // 🛡️ Safety check: If current feeds is empty, don't update via map merge.
          // This can happen if the store was reset or not yet hydrated.
          // Instead, trigger a full reload to get the complete feed list.
          if (state.feeds.length === 0) {
            console.warn(
              '[Queue] state.feeds is empty, skipping partial update and triggering full reload',
            )
            // Schedule loadFeeds in next tick to avoid state update during setState
            setTimeout(() => loadFeeds(), 0)
            return state
          }

          const feedMap = new Map(state.feeds.map((f) => [f.id, f]))
          console.log('[Queue] feedMap size before update:', feedMap.size)

          for (const update of payload.feeds!) {
            const existing = feedMap.get(update.id)
            if (existing) {
              feedMap.set(update.id, { ...existing, ...update })
            }
          }
          const updatedFeeds = Array.from(feedMap.values())
          console.log('[Queue] Updated feeds count:', updatedFeeds.length)

          // Save to cache after partial update
          try {
            localStorage.setItem(
              'livo-feeds-cache',
              JSON.stringify(updatedFeeds),
            )
          } catch {
            /* ignore quota errors */
          }
          return { feeds: updatedFeeds }
        })
      } else {
        console.log('[Queue] No feeds in payload, doing full reload')
        loadFeeds()
      }
    } else {
      console.log('[Queue] No feedIds in payload, doing full reload')
      loadFeeds()
    }

    reloadEntriesForCurrentScope()
  })

  window.api.on('entries:enriched', () => {
    reloadEntriesForCurrentScope()
  })

  window.api.on('entries:repaired', () => {
    const { clearListCache } = useEntryStore.getState()
    clearListCache()
    reloadEntriesForCurrentScope()
  })

  console.log('[Queue] Background event listeners setup')
}

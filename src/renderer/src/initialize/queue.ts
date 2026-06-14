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
    const { loadFeeds } = useFeedStore.getState()

    if (payload?.feedIds && payload.feedIds.length > 0) {
      const currentFeeds = useFeedStore.getState().feeds
      const needsFullReload = payload.feedIds.some(
        (id: string) => !currentFeeds.find((f) => f.id === id),
      )

      if (needsFullReload) {
        loadFeeds()
      } else if (payload.feeds && payload.feeds.length > 0) {
        useFeedStore.setState((state) => {
          const feedMap = new Map(state.feeds.map((f) => [f.id, f]))
          for (const update of payload.feeds!) {
            const existing = feedMap.get(update.id)
            if (existing) {
              feedMap.set(update.id, { ...existing, ...update })
            }
          }
          const updatedFeeds = Array.from(feedMap.values())
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
        loadFeeds()
      }
    } else {
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

import { RootTabId } from '../navigation/AppRouter'
import { EntryCardModel } from '../models/LivoModels'
import {
  describeError,
  duplicateKeyCount,
  homeEntryRenderBaseKey,
} from './HomeEntryUtils'
import {
  HOME_ASYNC_ERROR_DEBUG_ENABLED,
  HOME_ASYNC_ERROR_PREFIX,
  HOME_GROUP_DEBUG_ENABLED,
  HOME_GROUP_DEBUG_PREFIX,
  HOME_LOAD_MORE_DEBUG_ENABLED,
  HOME_LOAD_MORE_DEBUG_PREFIX,
  HOME_LOAD_STATE_DIAG_ENABLED,
  HOME_LOAD_STATE_DIAG_PREFIX,
  HOME_PERF_DIAG_ENABLED,
  HOME_PERF_DIAG_PREFIX,
  SubscriptionMode,
} from '../components/HomeRootConfig'

export interface IndexHomeDiagnosticsOwner {
  homePerfSessionId: number
  homePerfSessionStartedAt: number
  mode: SubscriptionMode
  currentRootTabId(): RootTabId
}

export class IndexHomeDiagnosticsLogger {
  private readonly owner: IndexHomeDiagnosticsOwner

  constructor(owner: IndexHomeDiagnosticsOwner) {
    this.owner = owner
  }

  describeError(error: Error | string | Object): string {
    return describeError(error)
  }

  logHomeAsyncError(stage: string, error: Error | string | Object): void {
    if (!HOME_ASYNC_ERROR_DEBUG_ENABLED) {
      return
    }
    console.error(`${HOME_ASYNC_ERROR_PREFIX} stage=${stage} error=${this.describeError(error)}`)
  }

  logHomeLoadMore(message: string): void {
    if (!HOME_LOAD_MORE_DEBUG_ENABLED) {
      return
    }
    console.info(`${HOME_LOAD_MORE_DEBUG_PREFIX} ${message}`)
  }

  logHomePerf(message: string): void {
    if (!HOME_PERF_DIAG_ENABLED) {
      return
    }
    const elapsed = this.owner.homePerfSessionStartedAt > 0 ? Date.now() - this.owner.homePerfSessionStartedAt : 0
    console.info(`${HOME_PERF_DIAG_PREFIX} sid=${this.owner.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  logHomeLoadState(message: string): void {
    if (!HOME_LOAD_STATE_DIAG_ENABLED) {
      return
    }
    const elapsed = this.owner.homePerfSessionStartedAt > 0 ? Date.now() - this.owner.homePerfSessionStartedAt : 0
    console.info(`${HOME_LOAD_STATE_DIAG_PREFIX} sid=${this.owner.homePerfSessionId} t=${elapsed}ms ${message}`)
  }

  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void {
    if (!HOME_GROUP_DEBUG_ENABLED) {
      return
    }

    const idCounter: Map<string, number> = new Map<string, number>()
    const renderBaseCounter: Map<string, number> = new Map<string, number>()
    let articles = 0
    let social = 0
    let pictures = 0
    let videos = 0

    entries.forEach((entry: EntryCardModel) => {
      const idKey = (entry.id || '').trim()
      const idCount = idCounter.get(idKey) ?? 0
      idCounter.set(idKey, idCount + 1)

      const renderBaseKey = homeEntryRenderBaseKey(entry)
      const renderBaseCount = renderBaseCounter.get(renderBaseKey) ?? 0
      renderBaseCounter.set(renderBaseKey, renderBaseCount + 1)

      switch (entry.viewLabel) {
        case '社交':
          social += 1
          break
        case '图片':
          pictures += 1
          break
        case '视频':
          videos += 1
          break
        default:
          articles += 1
          break
      }
    })

    const duplicateIdCount = duplicateKeyCount(idCounter)
    const duplicateRenderBaseCount = duplicateKeyCount(renderBaseCounter)

    console.info(
      `${HOME_GROUP_DEBUG_PREFIX} ${stage} total=${entries.length} `
      + `articles=${articles} social=${social} pictures=${pictures} videos=${videos} `
      + `uniqueIds=${idCounter.size} dupIds=${duplicateIdCount} `
      + `uniqueRender=${renderBaseCounter.size} dupRender=${duplicateRenderBaseCount} `
      + `activeTab=${this.owner.currentRootTabId()} mode=${this.owner.mode}`,
    )
  }
}

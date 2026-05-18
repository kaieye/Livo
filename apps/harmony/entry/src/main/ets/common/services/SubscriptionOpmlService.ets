import { fileIo, picker } from '@kit.CoreFileKit'
import { AppContextService } from './AppContextService'
import { Feed, FeedViewType } from '../models/LivoModels'
import { FeedRepository } from '../repositories/FeedRepository'
import { HomeEntrySnapshotStore } from './HomeEntrySnapshotStore'
import { FeedRefreshCoordinator } from '../data/FeedRefreshCoordinator'
import { generateOpml, parseOpml } from '../utils/OpmlParser'
import { FeedIdentityResolver } from './FeedIdentityResolver'
import { bumpFeedsChangedSignal, shouldBumpFeedsChangedSignal } from '../utils/FeedChangeSignal'

const OPML_IMPORT_REFRESH_START_DELAY_MS: number = 0
const OPML_IMPORT_REFRESH_GAP_MS: number = 180
const OPML_IMPORT_IMPORT_YIELD_BATCH_SIZE: number = 12
const OPML_IMPORT_REFRESH_NOTIFY_BATCH: number = 3
export const OPML_IMPORT_AUTO_REFRESH_LIMIT: number = 8
export const OPML_IMPORT_LARGE_BATCH_HINT: string = '订阅较多，已暂停自动同步以避免卡顿。你可以稍后手动刷新。'
const OPML_IMPORT_DIAG_PREFIX: string = '[OPMLImportDiag]'

export type SubscriptionOpmlImportMode = 'merge' | 'overwrite'
export type SubscriptionOpmlExportStatus = 'cancelled' | 'success'
export type SubscriptionOpmlImportStatus = 'cancelled' | 'empty' | 'success'
type ExistingFeedImportResult = 'upgraded' | 'skipped' | 'failed'

export interface SubscriptionOpmlExportResult {
  status: SubscriptionOpmlExportStatus
  feedCount: number
}

export interface SubscriptionOpmlImportResult {
  status: SubscriptionOpmlImportStatus
  imported: number
  skipped: number
  failed: number
  importedFeedIds: string[]
}

export interface SubscriptionOpmlRefreshResult {
  total: number
  success: number
  failed: number
}

// 集中处理 OPML 文件、订阅源身份去重与导入后刷新，面板只消费结果并展示提示。
export class SubscriptionOpmlService {
  static async exportToFile(): Promise<SubscriptionOpmlExportResult> {
    const targetUri = await SubscriptionOpmlService.pickExportOpmlUri()
    if (!targetUri) {
      return { status: 'cancelled', feedCount: 0 }
    }

    const feeds = await FeedRepository.default.list()
    const opml = generateOpml(feeds)
    try {
      const file = fileIo.openSync(
        targetUri,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
      )
      try {
        fileIo.writeSync(file.fd, opml)
      } finally {
        fileIo.closeSync(file)
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '写入 OPML 文件失败')
    }
    return { status: 'success', feedCount: feeds.length }
  }

  static async importFromFile(mode: SubscriptionOpmlImportMode): Promise<SubscriptionOpmlImportResult> {
    const importStartedAt = Date.now()
    SubscriptionOpmlService.logImport(`import started mode=${mode}`)
    const targetUri = await SubscriptionOpmlService.pickImportOpmlUri()
    if (!targetUri) {
      SubscriptionOpmlService.logImport(`import cancelled mode=${mode} elapsedMs=${Date.now() - importStartedAt}`)
      return SubscriptionOpmlService.createImportResult('cancelled')
    }
    SubscriptionOpmlService.logImport(`import picked uri mode=${mode}`)

    const readStartedAt = Date.now()
    const xml = SubscriptionOpmlService.readTextFromUri(targetUri)
    SubscriptionOpmlService.logImport(`import read file elapsedMs=${Date.now() - readStartedAt} size=${xml.length}`)

    const parseStartedAt = Date.now()
    const opmlFeeds = parseOpml(xml)
    SubscriptionOpmlService.logImport(`import parsed feeds elapsedMs=${Date.now() - parseStartedAt} count=${opmlFeeds.length}`)
    if (opmlFeeds.length === 0) {
      SubscriptionOpmlService.logImport(`import aborted, no feeds mode=${mode} elapsedMs=${Date.now() - importStartedAt}`)
      return SubscriptionOpmlService.createImportResult('empty')
    }

    const existingStartedAt = Date.now()
    const existingFeeds = await FeedRepository.default.list()
    SubscriptionOpmlService.logImport(`import loaded existing feeds elapsedMs=${Date.now() - existingStartedAt} count=${existingFeeds.length}`)
    const existingFeedByIdentityKey = SubscriptionOpmlService.createExistingFeedIdentityMap(existingFeeds)

    if (mode === 'overwrite') {
      const overwriteStartedAt = Date.now()
      for (const feed of existingFeeds) {
        await FeedRepository.default.remove(feed.id)
        await HomeEntrySnapshotStore.removeByFeedId(feed.id)
      }
      SubscriptionOpmlService.logImport(`import overwrite removed feeds count=${existingFeeds.length} elapsedMs=${Date.now() - overwriteStartedAt}`)
      existingFeedByIdentityKey.clear()
    }

    const seenInOpml: Set<string> = new Set<string>()
    const importedFeedIds: string[] = []
    let imported = 0
    let skipped = 0
    let failed = 0

    for (let index = 0; index < opmlFeeds.length; index += 1) {
      const opmlFeed = opmlFeeds[index]
      if (!opmlFeed) {
        skipped += 1
        continue
      }
      if (index > 0 && index % OPML_IMPORT_IMPORT_YIELD_BATCH_SIZE === 0) {
        await SubscriptionOpmlService.delay(0)
        SubscriptionOpmlService.logImport(`import yielded index=${index} imported=${imported} skipped=${skipped} failed=${failed}`)
      }

      const url = FeedIdentityResolver.normalizeImportedUrl(opmlFeed.xmlUrl || '')
      const siteUrl = FeedIdentityResolver.normalizeImportedUrl(opmlFeed.htmlUrl || '')
      if (!url) {
        skipped += 1
        continue
      }

      const importedView = FeedIdentityResolver.inferFeedViewByUrl(url)
      const identityKeys = FeedIdentityResolver.feedIdentityKeys(url, siteUrl)
      if (identityKeys.length === 0 || SubscriptionOpmlService.hasSeenIdentityKey(identityKeys, seenInOpml)) {
        skipped += 1
        continue
      }
      identityKeys.forEach((identityKey: string) => seenInOpml.add(identityKey))

      const matchedExistingFeed = mode === 'merge'
        ? SubscriptionOpmlService.findExistingFeed(identityKeys, existingFeedByIdentityKey)
        : undefined

      if (mode === 'merge' && matchedExistingFeed) {
        const existingResult = await SubscriptionOpmlService.importExistingFeed(
          matchedExistingFeed,
          importedView,
          url,
          siteUrl,
          opmlFeed.title || '',
          opmlFeed.category || '',
          identityKeys,
          existingFeedByIdentityKey,
        )
        if (existingResult === 'upgraded') {
          importedFeedIds.push(matchedExistingFeed.id)
          imported += 1
        } else if (existingResult === 'failed') {
          failed += 1
        } else {
          skipped += 1
        }
        continue
      }

      try {
        const createdFeed = await FeedRepository.default.create({
          title: (opmlFeed.title || url).trim(),
          url,
          siteUrl,
          imageUrl: '',
          description: '',
          category: (opmlFeed.category || '').trim(),
          view: importedView,
          showInAll: true,
        })
        importedFeedIds.push(createdFeed.id)
        imported += 1
      } catch (_error) {
        failed += 1
      }
    }

    bumpFeedsChangedSignal()
    SubscriptionOpmlService.logImport(`import finished mode=${mode} elapsedMs=${Date.now() - importStartedAt} imported=${imported} skipped=${skipped} failed=${failed} pendingRefresh=${importedFeedIds.length}`)
    return {
      status: 'success',
      imported,
      skipped,
      failed,
      importedFeedIds,
    }
  }

  static async refreshImportedFeedsInBackground(feedIds: string[]): Promise<SubscriptionOpmlRefreshResult> {
    const targetFeedIds = SubscriptionOpmlService.dedupeFeedIds(feedIds)
    if (targetFeedIds.length === 0) {
      SubscriptionOpmlService.logImport('background refresh skipped, no targets')
      return { total: 0, success: 0, failed: 0 }
    }

    const total = targetFeedIds.length
    let completed = 0
    let success = 0
    let failed = 0
    const startedAt = Date.now()
    SubscriptionOpmlService.logImport(`background refresh scheduled total=${total} startDelayMs=${OPML_IMPORT_REFRESH_START_DELAY_MS}`)
    await SubscriptionOpmlService.delay(OPML_IMPORT_REFRESH_START_DELAY_MS)
    SubscriptionOpmlService.logImport(`background refresh started total=${total}`)

    for (let index = 0; index < total; index += 1) {
      const feedId = targetFeedIds[index]
      if (!feedId) {
        completed += 1
        SubscriptionOpmlService.bumpRefreshSignalIfNeeded(completed, total)
        continue
      }

      if (index % 5 === 0 || index + 1 === total) {
        SubscriptionOpmlService.logImport(`background refresh progress index=${index + 1}/${total} completed=${completed} success=${success} failed=${failed}`)
      }

      if (index > 0) {
        await SubscriptionOpmlService.delay(OPML_IMPORT_REFRESH_GAP_MS)
      }

      try {
        await FeedRefreshCoordinator.default.refreshFeed(feedId, true, false, false, false)
        success += 1
      } catch (_error) {
        failed += 1
      }

      completed += 1
      SubscriptionOpmlService.bumpRefreshSignalIfNeeded(completed, total)
    }

    SubscriptionOpmlService.logImport(`background refresh finished elapsedMs=${Date.now() - startedAt} total=${total} success=${success} failed=${failed}`)
    return { total, success, failed }
  }

  private static createImportResult(status: SubscriptionOpmlImportStatus): SubscriptionOpmlImportResult {
    return {
      status,
      imported: 0,
      skipped: 0,
      failed: 0,
      importedFeedIds: [],
    }
  }

  private static createExistingFeedIdentityMap(feeds: Feed[]): Map<string, Feed> {
    const existingFeedByIdentityKey: Map<string, Feed> = new Map<string, Feed>()
    feeds.forEach((feed: Feed) => {
      FeedIdentityResolver.feedIdentityKeys(feed.url, feed.siteUrl || '').forEach((identityKey: string) => {
        if (!existingFeedByIdentityKey.has(identityKey)) {
          existingFeedByIdentityKey.set(identityKey, feed)
        }
      })
    })
    return existingFeedByIdentityKey
  }

  private static async importExistingFeed(
    existingFeed: Feed,
    importedView: FeedViewType,
    url: string,
    siteUrl: string,
    title: string,
    category: string,
    identityKeys: string[],
    existingFeedByIdentityKey: Map<string, Feed>,
  ): Promise<ExistingFeedImportResult> {
    if (existingFeed.view === importedView || importedView !== FeedViewType.SocialMedia) {
      SubscriptionOpmlService.rememberExistingIdentityKeys(identityKeys, existingFeed, existingFeedByIdentityKey)
      return 'skipped'
    }

    try {
      await FeedRepository.default.update(existingFeed.id, {
        title: (title || url).trim(),
        url,
        siteUrl,
        imageUrl: '',
        description: '',
        category: (category || '').trim(),
        view: importedView,
        showInAll: true,
      })
      SubscriptionOpmlService.rememberExistingIdentityKeys(identityKeys, existingFeed, existingFeedByIdentityKey)
      return 'upgraded'
    } catch (_error) {
      return 'failed'
    }
  }

  private static rememberExistingIdentityKeys(
    identityKeys: string[],
    feed: Feed,
    existingFeedByIdentityKey: Map<string, Feed>,
  ): void {
    identityKeys.forEach((identityKey: string) => {
      if (!existingFeedByIdentityKey.has(identityKey)) {
        existingFeedByIdentityKey.set(identityKey, feed)
      }
    })
  }

  private static findExistingFeed(identityKeys: string[], existingFeedByIdentityKey: Map<string, Feed>): Feed | undefined {
    for (const identityKey of identityKeys) {
      const matchedFeed = existingFeedByIdentityKey.get(identityKey)
      if (matchedFeed) {
        return matchedFeed
      }
    }
    return undefined
  }

  private static hasSeenIdentityKey(identityKeys: string[], seenInOpml: Set<string>): boolean {
    for (const identityKey of identityKeys) {
      if (seenInOpml.has(identityKey)) {
        return true
      }
    }
    return false
  }

  private static async pickImportOpmlUri(): Promise<string> {
    const documentPicker = new picker.DocumentViewPicker(AppContextService.getContext())
    const options = new picker.DocumentSelectOptions()
    options.maxSelectNumber = 1
    options.fileSuffixFilters = ['OPML|.opml,.xml']
    const uris = await documentPicker.select(options)
    if (!uris || uris.length === 0) {
      return ''
    }
    return uris[0]
  }

  private static async pickExportOpmlUri(): Promise<string> {
    const documentPicker = new picker.DocumentViewPicker(AppContextService.getContext())
    const options = new picker.DocumentSaveOptions()
    options.newFileNames = ['livo-subscriptions.opml']
    options.fileSuffixChoices = ['OPML|.opml']
    const uris = await documentPicker.save(options)
    if (!uris || uris.length === 0) {
      return ''
    }
    return uris[0]
  }

  private static readTextFromUri(uri: string): string {
    try {
      const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY)
      try {
        const bytes: number[] = []
        const bufferSize = 4096
        while (true) {
          const buffer = new ArrayBuffer(bufferSize)
          const readLength = fileIo.readSync(file.fd, buffer)
          if (readLength <= 0) {
            break
          }
          const view = new Uint8Array(buffer).subarray(0, readLength)
          view.forEach((value: number) => {
            bytes.push(value)
          })
        }
        return SubscriptionOpmlService.decodeUtf8Bytes(new Uint8Array(bytes))
      } finally {
        fileIo.closeSync(file)
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '读取文件失败')
    }
  }

  private static decodeUtf8Bytes(bytes: Uint8Array): string {
    if (bytes.length === 0) {
      return ''
    }

    let encoded = ''
    bytes.forEach((value: number) => {
      const hex = value.toString(16).padStart(2, '0')
      encoded += `%${hex}`
    })

    try {
      return decodeURIComponent(encoded)
    } catch (_error) {
      let fallback = ''
      bytes.forEach((value: number) => {
        fallback += String.fromCharCode(value)
      })
      return fallback
    }
  }

  private static dedupeFeedIds(feedIds: string[]): string[] {
    const result: string[] = []
    feedIds.forEach((feedId: string) => {
      const normalized = (feedId || '').trim()
      if (normalized && !result.includes(normalized)) {
        result.push(normalized)
      }
    })
    return result
  }

  private static bumpRefreshSignalIfNeeded(completed: number, total: number): void {
    // 分批通知界面刷新，避免最后一个订阅源触发一次过重重绘。
    if (shouldBumpFeedsChangedSignal(completed, total, OPML_IMPORT_REFRESH_NOTIFY_BATCH)) {
      bumpFeedsChangedSignal()
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), ms)
    })
  }

  private static logImport(message: string): void {
    console.info(`${OPML_IMPORT_DIAG_PREFIX} ${message}`)
  }
}


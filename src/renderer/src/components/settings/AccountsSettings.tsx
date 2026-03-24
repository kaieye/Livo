import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { FeedViewType, type AccountProvider } from '../../../../shared/types'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../../shared/discover-data'
import { useAccountStatusQuery } from '../../hooks/useAccountStatusQuery'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { accountStatusQueryOptions } from '../../lib/query-definitions'
import type { AccountStatusResult } from '../../lib/account-status'
import { useFeedStore } from '../../store/feed-store'

interface AccountCardConfig {
  provider: AccountProvider
  name: string
  colorClass: string
  description: string
}

interface PendingBilibiliCreator {
  mid: number
  uname: string
  exists: boolean
}

interface BilibiliImportProgress {
  total: number
  completed: number
  imported: number
  skipped: number
  failed: number
}

type BilibiliRouteType = 'video' | 'dynamic'

const BILIBILI_IMPORT_VIEW_OPTIONS: Array<{
  view: FeedViewType
  label: string
}> = [
  { view: FeedViewType.Videos, label: '视频' },
  { view: FeedViewType.SocialMedia, label: '社交媒体' },
]

const BILIBILI_RSSHUB_FALLBACK_INSTANCES = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub-instance.zeabur.app',
]
const BILIBILI_FOLLOWINGS_CACHE_KEY = 'livo.bilibili.followings.cache.v1'

interface BilibiliFollowingsCache {
  creators: Array<{ mid: number; uname: string }>
  rsshubBase: string
  routeType: BilibiliRouteType
  updatedAt: number
}

function loadBilibiliFollowingsCache(): BilibiliFollowingsCache | null {
  try {
    const raw = localStorage.getItem(BILIBILI_FOLLOWINGS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BilibiliFollowingsCache>
    if (
      !Array.isArray(parsed.creators) ||
      !parsed.rsshubBase ||
      !parsed.routeType ||
      !parsed.updatedAt
    )
      return null
    return {
      creators: parsed.creators
        .map((x) => ({
          mid: Number(x.mid),
          uname: String(x.uname || '').trim(),
        }))
        .filter(
          (x) => Number.isFinite(x.mid) && x.mid > 0 && x.uname.length > 0,
        ),
      rsshubBase: String(parsed.rsshubBase).replace(/\/+$/, ''),
      routeType: parsed.routeType === 'dynamic' ? 'dynamic' : 'video',
      updatedAt: Number(parsed.updatedAt),
    }
  } catch {
    return null
  }
}

function saveBilibiliFollowingsCache(cache: BilibiliFollowingsCache): void {
  try {
    localStorage.setItem(BILIBILI_FOLLOWINGS_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage write errors.
  }
}

function extractBilibiliUidFromFeedUrl(rawUrl: string): number | null {
  try {
    const parsed = new URL(rawUrl)
    const m = parsed.pathname.match(
      /\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    if (!m?.[1]) return null
    const uid = Number(m[1])
    return Number.isFinite(uid) && uid > 0 ? uid : null
  } catch {
    const m = rawUrl.match(
      /\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i,
    )
    if (!m?.[1]) return null
    const uid = Number(m[1])
    return Number.isFinite(uid) && uid > 0 ? uid : null
  }
}

function buildBilibiliImportUrl(
  base: string,
  uid: number,
  view: FeedViewType,
): string {
  const normalizedBase = base.replace(/\/+$/, '')
  if (view === FeedViewType.Articles)
    return `${normalizedBase}/bilibili/user/article/${uid}`
  if (view === FeedViewType.Videos)
    return `${normalizedBase}/bilibili/user/video/${uid}`
  if (view === FeedViewType.SocialMedia)
    return `${normalizedBase}/bilibili/user/dynamic/${uid}`
  return `${normalizedBase}/bilibili/user/video/${uid}`
}

const ACCOUNT_CARDS: AccountCardConfig[] = [
  {
    provider: 'youtube',
    name: 'YouTube',
    colorClass: 'text-red-500',
    description: '用于关联 YouTube 会话并获取账号名称。',
  },
  {
    provider: 'x',
    name: 'X / Twitter',
    colorClass: 'text-slate-700 dark:text-slate-200',
    description: '用于关联 X 会话并获取账号名称。',
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    colorClass: 'text-pink-500',
    description: '用于关联 Instagram 会话并获取账号名称。',
  },
  {
    provider: 'bilibili',
    name: 'Bilibili',
    colorClass: 'text-sky-500',
    description: '用于关联 Bilibili 会话，可一键导入关注列表。',
  },
]

export function AccountsSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selfChecking, setSelfChecking] = useState(false)
  const [selfCheckSummary, setSelfCheckSummary] = useState<string | null>(null)
  const [selfCheckRows, setSelfCheckRows] = useState<
    Array<{ name: string; pass: boolean; detail: string }>
  >([])

  const handleSelfCheck = useCallback(async () => {
    setSelfChecking(true)
    setSelfCheckSummary(null)
    setSelfCheckRows([])

    try {
      const results = await Promise.all(
        ACCOUNT_CARDS.map(async (card) => {
          try {
            const status = await queryClient.fetchQuery(
              accountStatusQueryOptions(card.provider),
            )
            const pass = status.linked && !!status.displayName
            const detail = pass
              ? `通过: ${status.displayName}`
              : (status.error ??
                (status.linked ? '已登录但未获取到账号名' : '未关联'))
            return { name: card.name, pass, detail }
          } catch (err) {
            return {
              name: card.name,
              pass: false,
              detail: err instanceof Error ? err.message : String(err),
            }
          }
        }),
      )

      setSelfCheckRows(results)
      const passed = results.filter((x) => x.pass).length
      if (passed === results.length) {
        setSelfCheckSummary(`一键自检通过（${passed}/${results.length}）`)
      } else {
        setSelfCheckSummary(`一键自检未通过（${passed}/${results.length}）`)
      }
    } finally {
      setSelfChecking(false)
    }
  }, [queryClient])

  return (
    <div className="space-y-8">
      <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
        {t('settings.accountsDesc')}
      </p>

      <div className="space-y-3 rounded-xl border bg-white p-4 dark:bg-surface-dark-secondary">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelfCheck}
            disabled={selfChecking}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs text-white disabled:opacity-60"
          >
            {selfChecking && <Loader2 size={14} className="animate-spin" />}
            一键自检
          </button>
          {selfCheckSummary && (
            <span
              className={`text-xs ${selfCheckSummary.includes('通过') ? 'text-green-600' : 'text-red-500'}`}
            >
              {selfCheckSummary}
            </span>
          )}
        </div>
        {selfCheckRows.length > 0 && (
          <div className="space-y-1">
            {selfCheckRows.map((row) => (
              <div key={row.name} className="flex items-start gap-2 text-xs">
                <span className={row.pass ? 'text-green-600' : 'text-red-500'}>
                  {row.pass ? '✓' : '✕'}
                </span>
                <span className="min-w-24 font-medium">{row.name}</span>
                <span className="text-text-secondary dark:text-text-dark-secondary">
                  {row.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {ACCOUNT_CARDS.map((card) => (
          <AccountCard key={card.provider} config={card} />
        ))}
      </div>
    </div>
  )
}

function AccountCard({ config }: { config: AccountCardConfig }) {
  const queryClient = useQueryClient()
  const feeds = useFeedStore((s) => s.feeds)
  const loadFeeds = useFeedStore((s) => s.loadFeeds)
  const statusQuery = useAccountStatusQuery(config.provider)

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [manualName, setManualName] = useState('')
  const [pendingCreators, setPendingCreators] = useState<
    PendingBilibiliCreator[] | null
  >(null)
  const [pendingRsshubBase, setPendingRsshubBase] = useState<string | null>(
    null,
  )
  const [, setPendingRouteType] = useState<BilibiliRouteType>('video')
  const [previewStats, setPreviewStats] = useState<{
    total: number
    canImport: number
    exists: number
  } | null>(null)
  const [selectedCreatorMids, setSelectedCreatorMids] = useState<number[]>([])
  const [selectedImportViews, setSelectedImportViews] = useState<
    FeedViewType[]
  >([FeedViewType.Videos])
  const [followingsCacheUpdatedAt, setFollowingsCacheUpdatedAt] = useState<
    number | null
  >(() => loadBilibiliFollowingsCache()?.updatedAt ?? null)
  const [importProgress, setImportProgress] =
    useState<BilibiliImportProgress | null>(null)
  const status = statusQuery.data ?? { linked: false, displayName: null }
  const isStatusLoading = statusQuery.isLoading && !statusQuery.data
  const refreshStatus = useCallback(async () => {
    const queryOptions = accountStatusQueryOptions(config.provider)
    try {
      const next = await queryClient.fetchQuery(queryOptions)
      queryClient.setQueryData(queryOptions.queryKey, next)
      return next
    } catch {
      const fallback: AccountStatusResult = {
        provider: config.provider,
        linked: false,
        displayName: null,
        error: undefined,
      }
      queryClient.setQueryData(queryOptions.queryKey, fallback)
      return fallback
    }
  }, [config.provider, queryClient])

  const handleLink = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const result = window.api.accounts
        ? await window.api.accounts.link(config.provider)
        : config.provider === 'youtube'
          ? await window.api.video.ytLogin()
          : {
              success: false,
              error: '当前版本未注入 accounts API，请重启应用后重试',
            }
      if (result.success) {
        setFeedback('关联成功')
        await refreshStatus()
      } else {
        setFeedback('关联失败，请重试')
        setErrorDetail(result.error ?? null)
      }
    } catch (err) {
      setFeedback('关联失败，请重试')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [config.provider, refreshStatus])

  const handleUnlink = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const result = window.api.accounts
        ? await window.api.accounts.unlink(config.provider)
        : config.provider === 'youtube'
          ? await window.api.video.ytLogout()
          : {
              success: false,
              error: '当前版本未注入 accounts API，请重启应用后重试',
            }
      if (result.success) {
        setFeedback('已取消关联')
        await refreshStatus()
      } else {
        setFeedback('取消关联失败')
        setErrorDetail(result.error ?? null)
      }
    } catch (err) {
      setFeedback('取消关联失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [config.provider, refreshStatus])

  const handleCheck = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const next = await refreshStatus()
      if (next.linked && next.displayName) {
        setFeedback('检查结果：已关联成功')
      } else {
        setFeedback('检查结果：未关联成功')
        setErrorDetail(
          next.error ?? (next.linked ? '已登录但未获取到账号名' : '未关联'),
        )
      }
    } catch (err) {
      setFeedback('检查关联失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [refreshStatus])

  const handleSaveName = useCallback(async () => {
    const name = manualName.trim()
    if (!name) {
      setFeedback('请先输入账号名')
      return
    }
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      if (!window.api.accounts) {
        setFeedback('当前版本不支持手动保存账号名')
        return
      }
      const result = await window.api.accounts.setDisplayName(
        config.provider,
        name,
      )
      if (!result.success) {
        setFeedback('保存账号名失败')
        setErrorDetail(result.error ?? null)
        return
      }
      setFeedback('账号名已保存，正在重新检查...')
      await refreshStatus()
      setManualName('')
    } catch (err) {
      setFeedback('保存账号名失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [config.provider, manualName, refreshStatus])

  const applyPreviewCreators = useCallback(
    (
      creators: Array<{ mid: number; uname: string }>,
      rsshubBase: string,
      routeType: BilibiliRouteType,
      fromCache: boolean,
      cacheUpdatedAt?: number,
    ) => {
      const existingUids = new Set<number>()
      for (const feed of feeds) {
        const uid = extractBilibiliUidFromFeedUrl(feed.url)
        if (uid) existingUids.add(uid)
      }
      let canImport = 0
      let exists = 0
      const nextPending: PendingBilibiliCreator[] = []
      const nextSelected: number[] = []
      for (const creator of creators) {
        const isExisting = existingUids.has(creator.mid)
        nextPending.push({
          mid: creator.mid,
          uname: creator.uname,
          exists: isExisting,
        })
        if (isExisting) {
          exists += 1
        } else {
          canImport += 1
          nextSelected.push(creator.mid)
        }
      }

      setPendingCreators(nextPending)
      setPendingRsshubBase(rsshubBase)
      setPendingRouteType(routeType)
      setPreviewStats({ total: creators.length, canImport, exists })
      setSelectedCreatorMids(nextSelected)
      if (cacheUpdatedAt) setFollowingsCacheUpdatedAt(cacheUpdatedAt)

      let templateHost = rsshubBase
      try {
        templateHost = new URL(rsshubBase).host
      } catch {
        // Keep raw base string when URL parsing fails.
      }
      const cacheHint = fromCache ? '（缓存）' : ''
      setFeedback(
        `预览完成${cacheHint}：共 ${creators.length} 个关注，可新增 ${canImport}，已存在 ${exists}，导入模板 ${routeType}@${templateHost}`,
      )
    },
    [feeds],
  )

  const handlePreviewBilibiliFollowings = useCallback(
    async (forceRefresh = false) => {
      if (config.provider !== 'bilibili') return

      setPreviewing(true)
      setFeedback(null)
      setErrorDetail(null)
      setPendingCreators(null)
      setPendingRsshubBase(null)
      setPendingRouteType('video')
      setPreviewStats(null)
      setSelectedCreatorMids([])

      try {
        if (!forceRefresh) {
          const cache = loadBilibiliFollowingsCache()
          if (cache && cache.creators.length > 0) {
            applyPreviewCreators(
              cache.creators,
              cache.rsshubBase,
              cache.routeType,
              true,
              cache.updatedAt,
            )
            return
          }
        }

        const accountsApi = (
          window.api as unknown as { accounts?: Record<string, unknown> }
        ).accounts
        const followingsFn =
          accountsApi && typeof accountsApi['bilibiliFollowings'] === 'function'
            ? (accountsApi['bilibiliFollowings'] as () => Promise<{
                success: boolean
                creators?: Array<{ mid: number; uname: string }>
                error?: string
              }>)
            : null

        if (!followingsFn) {
          const available = accountsApi
            ? Object.keys(accountsApi).join(', ')
            : 'none'
          setFeedback('当前运行进程未注入 B站关注列表接口')
          setErrorDetail(
            `请完全重启应用主进程后重试。accounts methods: ${available || 'none'}`,
          )
          return
        }

        const followingsResult = await followingsFn()
        if (!followingsResult.success) {
          setFeedback('预览失败')
          setErrorDetail(followingsResult.error ?? '读取关注列表失败')
          return
        }

        const creators = followingsResult.creators ?? []
        if (creators.length === 0) {
          setFeedback('未读取到关注列表')
          return
        }

        const settings = await window.api.settings.get().catch(() => null)
        const configuredBase = (
          settings?.general?.rsshubInstance?.trim() || DEFAULT_RSSHUB_INSTANCE
        ).replace(/\/+$/, '')
        const allBases = [
          configuredBase,
          ...BILIBILI_RSSHUB_FALLBACK_INSTANCES.filter(
            (x) => x !== configuredBase,
          ),
        ]

        // Use configured instance + video route directly for preview/import template.
        // This avoids slow per-UID probing during preview.
        const routeType: BilibiliRouteType = 'video'
        const rsshubBase = allBases[0] || configuredBase

        const now = Date.now()
        saveBilibiliFollowingsCache({
          creators,
          rsshubBase,
          routeType,
          updatedAt: now,
        })
        applyPreviewCreators(creators, rsshubBase, routeType, false, now)
      } catch (err) {
        setFeedback('预览失败')
        setErrorDetail(err instanceof Error ? err.message : String(err))
      } finally {
        setPreviewing(false)
        setTimeout(() => setFeedback(null), 5000)
      }
    },
    [applyPreviewCreators, config.provider],
  )

  const handleImportBilibiliFollowings = useCallback(async () => {
    if (config.provider !== 'bilibili') return
    if (!pendingCreators || !pendingRsshubBase) {
      setFeedback('请先预览后再导入')
      return
    }
    if (selectedCreatorMids.length === 0) {
      setFeedback('请至少勾选一个要导入的关注')
      return
    }
    if (selectedImportViews.length === 0) {
      setFeedback('请至少选择一个导入栏目')
      return
    }

    setImporting(true)
    setFeedback(null)
    setErrorDetail(null)

    try {
      const allBases = [
        pendingRsshubBase,
        ...BILIBILI_RSSHUB_FALLBACK_INSTANCES.filter(
          (x) => x !== pendingRsshubBase,
        ),
      ]
      const selectedCreators = pendingCreators.filter((creator) =>
        selectedCreatorMids.includes(creator.mid),
      )
      const CONCURRENCY = 10
      let imported = 0
      let skipped = 0
      let movedOutOfRecommended = 0
      let failed = 0
      setImportProgress({
        total: selectedCreators.length * selectedImportViews.length,
        completed: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
      })

      const existingByUidAndView = new Map<string, (typeof feeds)[number]>()
      for (const feed of feeds) {
        const uid = extractBilibiliUidFromFeedUrl(feed.url)
        if (!uid) continue
        existingByUidAndView.set(`${uid}:${feed.view}`, feed)
      }

      const queue = [...selectedCreators]
      const markProgress = (result: 'imported' | 'skipped' | 'failed') => {
        setImportProgress((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            completed: Math.min(prev.total, prev.completed + 1),
            imported: prev.imported + (result === 'imported' ? 1 : 0),
            skipped: prev.skipped + (result === 'skipped' ? 1 : 0),
            failed: prev.failed + (result === 'failed' ? 1 : 0),
          }
        })
      }
      const runWorker = async () => {
        while (queue.length > 0) {
          const creator = queue.shift()
          if (!creator) continue

          for (const targetView of selectedImportViews) {
            const canonicalUrl = buildBilibiliImportUrl(
              pendingRsshubBase,
              creator.mid,
              targetView,
            )
            const fallbackUrls = allBases
              .flatMap((base) => [
                buildBilibiliImportUrl(base, creator.mid, targetView),
              ])
              .filter((url, idx, arr) => arr.indexOf(url) === idx)
            const existing = existingByUidAndView.get(
              `${creator.mid}:${targetView}`,
            )

            if (existing) {
              skipped += 1
              const updates: {
                category?: string
                view?: FeedViewType
                url?: string
                title?: string
              } = {}
              if (existing.category === RECOMMENDED_CATEGORY) {
                updates.category = ''
                movedOutOfRecommended += 1
              }
              if (existing.view !== targetView) {
                updates.view = targetView
              }
              if (existing.url !== canonicalUrl) {
                updates.url = canonicalUrl
              }
              const preferredTitle = `${creator.uname} - Bilibili`
              if (existing.title !== preferredTitle) {
                updates.title = preferredTitle
              }
              if (Object.keys(updates).length > 0) {
                await window.api.feeds.update(existing.id, updates)
              }
              markProgress('skipped')
              continue
            }

            const preferredTitle = `${creator.uname} - Bilibili`
            let added = false
            for (const targetUrl of [
              canonicalUrl,
              ...fallbackUrls.filter((x) => x !== canonicalUrl),
            ]) {
              const result = (await window.api.feeds.add(
                targetUrl,
                undefined,
                targetView,
                preferredTitle,
              )) as {
                success: boolean
                error?: string
                feed?: { id: string }
              }
              if (!result.success) continue
              imported += 1
              added = true
              markProgress('imported')
              break
            }
            if (!added) {
              failed += 1
              markProgress('failed')
            }
          }
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length || 1) },
        () => runWorker(),
      )
      await Promise.all(workers)

      await loadFeeds()
      setPendingCreators(null)
      setPendingRsshubBase(null)
      setPendingRouteType('video')
      setPreviewStats(null)
      setSelectedCreatorMids([])
      setFeedback(
        `导入完成：新增 ${imported}，已存在 ${skipped}，转正式订阅 ${movedOutOfRecommended}，失败 ${failed}`,
      )
    } catch (err) {
      setFeedback('导入失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
      setImportProgress((prev) =>
        prev ? { ...prev, completed: prev.total } : prev,
      )
      setTimeout(() => setFeedback(null), 5000)
    }
  }, [
    config.provider,
    feeds,
    loadFeeds,
    pendingCreators,
    pendingRsshubBase,
    selectedCreatorMids,
    selectedImportViews,
  ])

  return (
    <div className="overflow-hidden rounded-xl border bg-white dark:bg-surface-dark-secondary">
      <div className="flex items-center gap-3 border-b bg-surface-secondary/50 px-4 py-3 dark:bg-surface-dark-tertiary/50">
        <span className={`text-sm font-semibold ${config.colorClass}`}>
          {config.name}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            status.linked && status.displayName
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {status.linked && status.displayName ? '已关联' : '未关联'}
        </span>
      </div>

      <div className="px-4 py-3.5">
        <p className="mb-3 text-xs text-text-secondary dark:text-text-dark-secondary">
          {config.description}
        </p>
        {status.displayName && (
          <p className="mb-3 text-xs text-text-secondary dark:text-text-dark-secondary">
            账号: {status.displayName}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              处理中...
            </div>
          ) : isStatusLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              正在检查状态...
            </div>
          ) : status.linked && status.displayName ? (
            <button
              onClick={handleUnlink}
              className="rounded-lg border border-red-200 px-4 py-2 text-xs text-red-500 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              取消关联
            </button>
          ) : (
            <button
              onClick={handleLink}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              关联账号
            </button>
          )}

          <button
            onClick={handleCheck}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
          >
            检查关联
          </button>

          {config.provider === 'bilibili' && (
            <button
              onClick={() => void handlePreviewBilibiliFollowings(false)}
              disabled={loading || importing || previewing}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
            >
              {(importing || previewing) && (
                <Loader2 size={12} className="animate-spin" />
              )}
              预览关注导入
            </button>
          )}
          {config.provider === 'bilibili' && (
            <button
              onClick={() => void handlePreviewBilibiliFollowings(true)}
              disabled={loading || importing || previewing}
              className="rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
            >
              刷新关注缓存
            </button>
          )}

          {feedback && (
            <div
              className={`flex items-center gap-1 text-xs ${feedback.includes('成功') || feedback.includes('完成') ? 'text-green-500' : 'text-red-500'}`}
            >
              {feedback.includes('成功') || feedback.includes('完成') ? (
                <Check size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              {feedback}
            </div>
          )}
        </div>

        {errorDetail && (
          <p className="mt-2 text-xs text-red-500">{errorDetail}</p>
        )}
        {config.provider === 'bilibili' && importProgress && (
          <div className="mt-2 rounded-md border border-border bg-surface-secondary/50 p-2 dark:bg-surface-dark-tertiary/50">
            <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
              <span>
                导入进度：{importProgress.completed}/{importProgress.total}
              </span>
              <span>
                新增 {importProgress.imported} · 跳过 {importProgress.skipped} ·
                失败 {importProgress.failed}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{
                  width: `${importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}
        {config.provider === 'bilibili' && followingsCacheUpdatedAt && (
          <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">
            关注缓存时间：{new Date(followingsCacheUpdatedAt).toLocaleString()}
          </p>
        )}
        {config.provider === 'bilibili' && previewStats && (
          <div className="mt-3 rounded-md border border-border bg-surface-secondary/60 p-2.5 dark:bg-surface-dark-tertiary/60">
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              预览结果：共 {previewStats.total} 个关注，可新增{' '}
              {previewStats.canImport}，已存在 {previewStats.exists}，已勾选{' '}
              {selectedCreatorMids.length}
            </p>
            {pendingCreators && pendingCreators.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="rounded border border-border bg-white/70 p-2 dark:bg-surface-dark-secondary/70">
                  <p className="mb-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
                    导入到栏目（可多选）
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {BILIBILI_IMPORT_VIEW_OPTIONS.map((opt) => {
                      const checked = selectedImportViews.includes(opt.view)
                      return (
                        <label
                          key={opt.view}
                          className="inline-flex items-center gap-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={loading || importing || previewing}
                            onChange={(e) => {
                              const nextChecked = e.target.checked
                              setSelectedImportViews((prev) => {
                                if (nextChecked) {
                                  if (prev.includes(opt.view)) return prev
                                  return [...prev, opt.view]
                                }
                                return prev.filter((v) => v !== opt.view)
                              })
                            }}
                          />
                          <span>{opt.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedCreatorMids(
                        pendingCreators
                          .filter((c) => !c.exists)
                          .map((c) => c.mid),
                      )
                    }
                    disabled={loading || importing || previewing}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
                  >
                    全选可导入
                  </button>
                  <button
                    onClick={() => setSelectedCreatorMids([])}
                    disabled={loading || importing || previewing}
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
                  >
                    清空选择
                  </button>
                </div>
                <div className="max-h-56 space-y-1 overflow-auto rounded border border-border bg-white/70 p-2 dark:bg-surface-dark-secondary/70">
                  {pendingCreators.map((creator) => {
                    const checked = selectedCreatorMids.includes(creator.mid)
                    return (
                      <label
                        key={creator.mid}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              creator.exists ||
                              loading ||
                              importing ||
                              previewing
                            }
                            onChange={(e) => {
                              const isChecked = e.target.checked
                              setSelectedCreatorMids((prev) =>
                                isChecked
                                  ? [...prev, creator.mid]
                                  : prev.filter((mid) => mid !== creator.mid),
                              )
                            }}
                          />
                          <span className="truncate">{creator.uname}</span>
                          <span className="text-text-secondary">
                            ({creator.mid})
                          </span>
                        </span>
                        <span
                          className={
                            creator.exists ? 'text-amber-600' : 'text-green-600'
                          }
                        >
                          {creator.exists ? '已订阅' : '可导入'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleImportBilibiliFollowings}
                disabled={
                  loading ||
                  importing ||
                  previewing ||
                  selectedCreatorMids.length === 0 ||
                  selectedImportViews.length === 0
                }
                className="rounded-md bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
              >
                确认导入
              </button>
              <button
                onClick={() => {
                  setPendingCreators(null)
                  setPendingRsshubBase(null)
                  setPendingRouteType('video')
                  setPreviewStats(null)
                  setSelectedCreatorMids([])
                }}
                disabled={loading || importing || previewing}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-secondary disabled:opacity-60 dark:hover:bg-surface-dark-tertiary"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {(!status.linked || !status.displayName) && (
          <div className="mt-3 flex items-center gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="手动输入账号名（自动识别失败时）"
              className="flex-1 rounded-md border bg-surface-secondary px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 dark:bg-surface-dark-tertiary"
              disabled={loading}
            />
            <button
              onClick={handleSaveName}
              disabled={loading || !manualName.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              保存账号名
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth-store'
import type { FeedSyncStatus, FeedViewType } from '../../../../shared/types'
import {
  AlertCircle,
  Check,
  Cloud,
  Loader2,
  LogOut,
  RefreshCw,
  User,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { DEFAULT_RSSHUB_INSTANCE } from '../../../../shared/discover-data'
import { useAccountStatusQuery } from '../../hooks/useAccountStatusQuery'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { refreshAccountStatus } from '../../lib/account-status'
import { useFeedStore } from '../../store/feed-store'
import { syncReadingActivityToServer } from '../../lib/reading-activity'
import {
  PROVIDER_CONFIGS,
  type ProviderConfig,
} from '../account/provider-config'
import { ReadingHeatmap } from './ReadingHeatmap'
import { WechatRssSettings } from './WechatRssSettings'

type AuthProvider = 'google' | 'wechat'

const AUTH_PROVIDERS: Array<{
  provider: AuthProvider
  name: string
  bindLabel: string
  colorClass: string
}> = [
  {
    provider: 'google',
    name: 'Google',
    bindLabel: '绑定 Google',
    colorClass: 'text-blue-600',
  },
  {
    provider: 'wechat',
    name: '微信',
    bindLabel: '绑定微信',
    colorClass: 'text-green-600',
  },
]

type AccountCardConfig = ProviderConfig

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
  { view: 2, label: '社交媒体' }, // FeedViewType.SocialMedia
  { view: 3, label: '视频' }, // FeedViewType.Videos
]

const BILIBILI_RSSHUB_FALLBACK_INSTANCES = [
  'https://rsshub.pseudoyu.com',
  'https://rsshub.rssforever.com',
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
  if (view === 1)
    // FeedViewType.Articles
    return `${normalizedBase}/bilibili/user/article/${uid}`
  if (view === 3)
    // FeedViewType.Videos
    return `${normalizedBase}/bilibili/user/video/${uid}`
  if (view === 2)
    // FeedViewType.SocialMedia
    return `${normalizedBase}/bilibili/user/dynamic/${uid}`
  return `${normalizedBase}/bilibili/user/video/${uid}`
}

const ACCOUNT_CARDS: AccountCardConfig[] = PROVIDER_CONFIGS

export function UserSettings() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <div className="space-y-4">
      {/* 当前登录账号卡片 */}
      <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            {/* 头像 */}
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="bg-accent/10 text-accent flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full">
                {isAuthenticated && user?.displayName ? (
                  <span className="text-2xl font-semibold">
                    {user.displayName[0].toUpperCase()}
                  </span>
                ) : (
                  <User size={28} />
                )}
              </div>
            )}

            {/* 用户信息 */}
            <div className="min-w-0 flex-1">
              {isAuthenticated && user ? (
                <>
                  <h3 className="truncate text-lg font-semibold">
                    {user.displayName}
                  </h3>
                  <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-sm">
                    通过 OAuth 登录
                  </p>
                  <p className="text-text-tertiary dark:text-text-dark-secondary/70 mt-1.5 text-xs">
                    用户 ID: {user.id}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">未登录</h3>
                  <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-sm">
                    登录以同步你的订阅和偏好设置
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 退出登录按钮 */}
          {isAuthenticated && user && <LogoutButton />}
        </div>

        {/* 当前账号的操作 */}
        {isAuthenticated && user && (
          <div className="mt-4 border-t pt-4">
            <div className="space-y-4">
              <AccountBindingPanel />
              <FeedSyncPanel />
            </div>
          </div>
        )}
      </div>

      {/* 阅读热力图 */}
      {isAuthenticated && user && (
        <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-4">
          <ReadingHeatmap />
        </div>
      )}

      {/* 登录方式 */}
      {!isAuthenticated && (
        <div>
          <h4 className="mb-3 text-sm font-medium">选择登录方式</h4>
          <div className="space-y-3">
            {AUTH_PROVIDERS.map((config) => (
              <LoginProviderCard key={config.provider} config={config} />
            ))}
          </div>
        </div>
      )}

      {/* 第三方平台关联 */}
      <div>
        <h4 className="mb-3 text-sm font-medium">第三方平台关联</h4>
        <p className="text-text-secondary dark:text-text-dark-secondary mb-4 text-xs">
          关联第三方平台账号，以获取关注列表、订阅内容等数据访问权限。
        </p>
        <div className="space-y-4">
          {ACCOUNT_CARDS.filter((c) => c.provider !== 'wechat-mp').map(
            (card) => (
              <AccountCard key={card.provider} config={card} />
            ),
          )}
          <WechatMpCard />
        </div>
      </div>
    </div>
  )
}

function formatLastSyncAt(value: number | null): string {
  if (!value) return '从未同步'
  const diffMs = Date.now() - value
  if (diffMs < 60 * 1000) return '刚刚'
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)} 分钟前`
  if (diffMs < 24 * 60 * 60 * 1000)
    return `${Math.floor(diffMs / 3600000)} 小时前`
  return new Date(value).toLocaleString()
}

function FeedSyncPanel() {
  const loadFeeds = useFeedStore((s) => s.loadFeeds)
  const [status, setStatus] = useState<FeedSyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await window.api.feeds.syncStatus()
      setStatus(nextStatus)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const handleSync = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setError(null)
    try {
      const result = await window.api.feeds.syncNow()
      if (result.success) {
        setStatus({
          isAuthenticated: result.isAuthenticated,
          lastSyncAt: result.lastSyncAt,
          pendingChanges: result.pendingChanges,
        })
        const parts: string[] = []
        if (result.uploaded > 0) parts.push(`上传 ${result.uploaded} 项`)
        if (result.downloaded > 0) parts.push(`下载 ${result.downloaded} 项`)
        setFeedback(
          parts.length > 0 ? `已同步：${parts.join('，')}` : '已是最新',
        )
        // 订阅同步完成后刷新本地列表 + 顺带同步阅读活动
        await loadFeeds()
        void syncReadingActivityToServer()
      } else {
        setError(result.error || '同步失败')
        await refreshStatus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步失败')
      await refreshStatus()
    } finally {
      setLoading(false)
      setTimeout(() => {
        setFeedback(null)
        setError(null)
      }, 3000)
    }
  }, [loadFeeds, refreshStatus])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Cloud size={15} className="text-accent" />
            <span>订阅源同步</span>
          </span>
          {(feedback || error) && (
            <span
              className={`flex items-center gap-1 text-xs font-normal ${
                error ? 'text-red-500' : 'text-green-600'
              }`}
            >
              {error ? <AlertCircle size={13} /> : <Check size={13} />}
              {error || feedback}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-text-secondary dark:text-text-dark-secondary text-xs">
          上次同步：{formatLastSyncAt(status?.lastSyncAt ?? null)}
          {status?.pendingChanges
            ? ` · 待上传 ${status.pendingChanges} 项`
            : ''}
        </div>
        <button
          onClick={handleSync}
          disabled={loading || status?.isAuthenticated === false}
          className="bg-accent hover:bg-accent-hover inline-flex h-8 min-w-[104px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {loading ? '同步中' : '立即同步'}
        </button>
      </div>
    </div>
  )
}

function AccountBindingPanel() {
  const user = useAuthStore((s) => s.user)
  const bindGoogle = useAuthStore((s) => s.bindGoogle)
  const bindWechat = useAuthStore((s) => s.bindWechat)
  const [bindingProvider, setBindingProvider] = useState<AuthProvider | null>(
    null,
  )
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const linkedProviders = new Set([
    ...(user?.providers ?? []),
    ...(user?.identities?.map((identity) => identity.provider) ?? []),
  ])

  const handleBind = useCallback(
    async (provider: AuthProvider) => {
      setBindingProvider(provider)
      setFeedback(null)
      try {
        if (provider === 'google') {
          await bindGoogle()
        } else {
          await bindWechat()
        }
        const providerName =
          AUTH_PROVIDERS.find((item) => item.provider === provider)?.name ??
          provider
        setFeedback({ type: 'success', message: `${providerName} 已绑定` })
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : '绑定失败',
        })
      } finally {
        setBindingProvider(null)
        setTimeout(() => setFeedback(null), 3000)
      }
    },
    [bindGoogle, bindWechat],
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {AUTH_PROVIDERS.map((config) => {
          const linked = linkedProviders.has(config.provider)
          const loading = bindingProvider === config.provider

          return (
            <div
              key={config.provider}
              className="border-border flex min-h-[72px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 dark:border-white/10"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={config.colorClass}>{config.name}</span>
                  {linked && <Check size={14} className="text-green-600" />}
                </div>
                <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
                  {linked ? '已绑定当前账号' : '未绑定'}
                </p>
              </div>

              {linked ? (
                <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  已绑定
                </span>
              ) : (
                <button
                  onClick={() => void handleBind(config.provider)}
                  disabled={bindingProvider !== null}
                  className="bg-accent hover:bg-accent-hover inline-flex h-8 min-w-[96px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? '绑定中' : config.bindLabel}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-1 text-xs ${
            feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {feedback.message}
        </div>
      )}
    </div>
  )
}

function LogoutButton() {
  const logout = useAuthStore((s) => s.logout)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleLogout = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    try {
      await logout()
      setFeedback('已退出登录')
    } catch (_err) {
      setFeedback('退出失败')
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [logout])

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <button
        onClick={handleLogout}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <LogOut size={14} />
        )}
        {loading ? '退出中...' : '退出登录'}
      </button>

      {feedback && (
        <div
          className={`flex items-center gap-1 text-xs ${feedback.includes('成功') ? 'text-green-600' : 'text-red-500'}`}
        >
          {feedback.includes('成功') ? (
            <Check size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {feedback}
        </div>
      )}
    </div>
  )
}

function LoginProviderCard({
  config,
}: {
  config: {
    provider: AuthProvider
    name: string
    bindLabel: string
    colorClass: string
  }
}) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const result =
        config.provider === 'google'
          ? await window.api.auth.loginGoogle()
          : await window.api.auth.loginWechat()

      if (result.success && result.user && result.token) {
        useAuthStore.getState().setUser(result.user, result.token)
        setFeedback('登录成功')
      } else {
        setFeedback('登录失败')
        setErrorDetail(result.error || '未知错误')
      }
    } catch (err) {
      setFeedback('登录失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [config.provider])

  return (
    <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              config.provider === 'google'
                ? 'bg-blue-50 dark:bg-blue-950/30'
                : 'bg-green-50 dark:bg-green-950/30'
            }`}
          >
            {config.provider === 'google' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-green-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8.5 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm.5 2.5c0-2-1.5-3.5-3.5-3.5S9 11 9 13c0 .5.1 1 .3 1.5l-2.8 1.4c-.3.1-.4.5-.3.8.1.2.3.3.5.3h.1l3.3-1.1c.6.1 1.2.1 1.9.1 2 0 3.5-1.5 3.5-3.5zM23 12c0-5.5-5.4-10-12-10S-1 6.5-1 12c0 3.3 2 6.3 5 8.2-.2.7-.6 2-1 3.2-.1.3.1.6.4.7h.2c.2 0 .4-.1.5-.2 1.6-1.4 3.3-2.9 4.2-3.6.9.1 1.8.2 2.7.2 6.6 0 12-4.5 12-10z" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-medium">{config.name}</p>
            <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
              通过 {config.name} 登录
            </p>
          </div>
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </div>

      {feedback && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-green-600">
          <Check size={14} />
          {feedback}
        </div>
      )}
      {errorDetail && (
        <div className="mt-2 text-xs text-red-500">{errorDetail}</div>
      )}
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
  >([3])
  const [followingsCacheUpdatedAt, setFollowingsCacheUpdatedAt] = useState<
    number | null
  >(() => loadBilibiliFollowingsCache()?.updatedAt ?? null)
  const [importProgress, setImportProgress] =
    useState<BilibiliImportProgress | null>(null)
  const status = statusQuery.data ?? { linked: false, displayName: null }
  const isStatusLoading = statusQuery.isLoading && !statusQuery.data
  const refreshStatus = useCallback(
    () => refreshAccountStatus(config.provider, queryClient),
    [config.provider, queryClient],
  )

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

        // Use configured instance + dynamic route as the default import template.
        // This better matches users' expectation of "following updates", while
        // still allowing them to opt into the video route explicitly.
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
    <div className="dark:bg-surface-dark-secondary overflow-hidden rounded-xl border bg-white">
      <div className="bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 flex items-center gap-3 border-b px-4 py-3">
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
        <p className="text-text-secondary dark:text-text-dark-secondary mb-3 text-xs">
          {config.description}
        </p>
        {status.displayName && (
          <p className="text-text-secondary dark:text-text-dark-secondary mb-3 text-xs">
            账号: {status.displayName}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <div className="text-text-secondary flex items-center gap-1.5 text-xs">
              <Loader2 size={14} className="animate-spin" />
              处理中...
            </div>
          ) : isStatusLoading ? (
            <div className="text-text-secondary flex items-center gap-1.5 text-xs">
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
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors"
            >
              关联账号
            </button>
          )}

          <button
            onClick={handleCheck}
            disabled={loading}
            className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-60"
          >
            检查关联
          </button>

          {config.provider === 'bilibili' && (
            <button
              onClick={() => void handlePreviewBilibiliFollowings(false)}
              disabled={loading || importing || previewing}
              className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-60"
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
              className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-60"
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
          <div className="border-border bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 mt-2 rounded-md border p-2">
            <div className="text-text-secondary dark:text-text-dark-secondary flex items-center justify-between text-xs">
              <span>
                导入进度：{importProgress.completed}/{importProgress.total}
              </span>
              <span>
                新增 {importProgress.imported} · 跳过 {importProgress.skipped} ·
                失败 {importProgress.failed}
              </span>
            </div>
            <div className="bg-surface-tertiary dark:bg-surface-dark-tertiary mt-1.5 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-accent h-full transition-[width] duration-200"
                style={{
                  width: `${importProgress.total > 0 ? Math.round((importProgress.completed / importProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}
        {config.provider === 'bilibili' && followingsCacheUpdatedAt && (
          <p className="text-text-secondary dark:text-text-dark-secondary mt-2 text-xs">
            关注缓存时间：{new Date(followingsCacheUpdatedAt).toLocaleString()}
          </p>
        )}
        {config.provider === 'bilibili' && previewStats && (
          <div className="border-border bg-surface-secondary/60 dark:bg-surface-dark-tertiary/60 mt-3 rounded-md border p-2.5">
            <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
              预览结果：共 {previewStats.total} 个关注，可新增{' '}
              {previewStats.canImport}，已存在 {previewStats.exists}，已勾选{' '}
              {selectedCreatorMids.length}
            </p>
            {pendingCreators && pendingCreators.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="border-border dark:bg-surface-dark-secondary/70 rounded border bg-white/70 p-2">
                  <p className="text-text-secondary dark:text-text-dark-secondary mb-1.5 text-xs">
                    导入到栏目（可多选，默认勾选视频）
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
                    className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded border px-2 py-1 text-xs disabled:opacity-60"
                  >
                    全选可导入
                  </button>
                  <button
                    onClick={() => setSelectedCreatorMids([])}
                    disabled={loading || importing || previewing}
                    className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded border px-2 py-1 text-xs disabled:opacity-60"
                  >
                    清空选择
                  </button>
                </div>
                <div className="border-border dark:bg-surface-dark-secondary/70 max-h-56 space-y-1 overflow-auto rounded border bg-white/70 p-2">
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
                className="bg-accent rounded-md px-3 py-1.5 text-xs text-white disabled:opacity-60"
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
                className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
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
              className="bg-surface-secondary focus:ring-accent/40 dark:bg-surface-dark-tertiary flex-1 rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2"
              disabled={loading}
            />
            <button
              onClick={handleSaveName}
              disabled={loading || !manualName.trim()}
              className="bg-accent rounded-md px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              保存账号名
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function WechatMpCard() {
  return (
    <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="#07C160"
          className="h-5 w-5"
        >
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.135 0 .243-.11.243-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.49.49 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
        </svg>
        <span className="text-sm font-medium text-green-600">微信公众号</span>
      </div>
      <WechatRssSettings />
    </div>
  )
}

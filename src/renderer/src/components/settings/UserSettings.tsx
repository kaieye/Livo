import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth-store'
import type { FeedSyncStatus } from '../../../../shared/types'
import {
  AlertCircle,
  Check,
  Cloud,
  Loader2,
  LogOut,
  RefreshCw,
  User,
} from 'lucide-react'

type AuthProvider = 'google' | 'wechat'

const AUTH_PROVIDERS: Array<{
  provider: AuthProvider
  name: string
  colorClass: string
}> = [
  {
    provider: 'google',
    name: 'Google',
    colorClass: 'text-blue-600',
  },
  {
    provider: 'wechat',
    name: '微信',
    colorClass: 'text-green-600',
  },
]

export function UserSettings() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <div className="space-y-6">
      {/* 当前登录账号卡片 */}
      <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-6">
        <div className="flex items-start gap-4">
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

        {/* 当前账号的操作 */}
        {isAuthenticated && user && (
          <div className="mt-4 border-t pt-4">
            <div className="space-y-4">
              <FeedSyncPanel />
              <LogoutButton />
            </div>
          </div>
        )}
      </div>

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

      {/* 说明 */}
      <div className="bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 rounded-lg p-4">
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs leading-relaxed">
          Livo 账号用于同步订阅源。如需关联第三方平台（B站、YouTube
          等）以获取关注列表，请前往「账号关联」页面。
        </p>
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
        const changed = result.uploaded + result.downloaded
        setFeedback(changed > 0 ? `已同步 ${changed} 项` : '已是最新')
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
  }, [refreshStatus])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Cloud size={15} className="text-accent" />
          <span>订阅源同步</span>
        </div>
        <div className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
          上次同步：{formatLastSyncAt(status?.lastSyncAt ?? null)}
          {status?.pendingChanges
            ? ` · 待上传 ${status.pendingChanges} 项`
            : ''}
        </div>
        {(feedback || error) && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs ${
              error ? 'text-red-500' : 'text-green-600'
            }`}
          >
            {error ? <AlertCircle size={13} /> : <Check size={13} />}
            {error || feedback}
          </div>
        )}
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  )
}

function LoginProviderCard({
  config,
}: {
  config: { provider: AuthProvider; name: string; colorClass: string }
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

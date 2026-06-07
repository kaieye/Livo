import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  Check,
  Loader2,
  LogOut,
  LogIn,
  RefreshCw,
} from 'lucide-react'
import { useAccountStatusQuery } from '../../hooks/useAccountStatusQuery'
import { refreshAccountStatus } from '../../lib/account-status'
import type { AccountProvider } from '../../../../shared/types'

const AUTH_PROVIDERS: Array<{
  provider: AccountProvider
  name: string
  icon: string
}> = [
  {
    provider: 'wechat',
    name: '微信',
    icon: '💬',
  },
  {
    provider: 'google',
    name: 'Google',
    icon: '🔵',
  },
]

export function UserSettings() {
  const { t } = useTranslation()
  const wechatStatus = useAccountStatusQuery('wechat')
  const googleStatus = useAccountStatusQuery('google')

  // 获取当前登录的账号（优先微信，其次 Google）
  const currentProvider =
    wechatStatus.data?.linked && wechatStatus.data?.displayName
      ? 'wechat'
      : googleStatus.data?.linked && googleStatus.data?.displayName
        ? 'google'
        : null

  const currentStatus =
    currentProvider === 'wechat' ? wechatStatus.data : googleStatus.data
  const currentProviderConfig = AUTH_PROVIDERS.find(
    (p) => p.provider === currentProvider,
  )

  return (
    <div className="space-y-6">
      {/* 用户信息卡片 */}
      <div className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-6">
        <div className="flex items-start gap-4">
          {/* 头像 */}
          <div className="bg-accent/10 text-accent flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-2xl font-semibold">
            {currentStatus?.displayName?.[0]?.toUpperCase() || '?'}
          </div>

          {/* 用户信息 */}
          <div className="min-w-0 flex-1">
            {currentStatus?.displayName ? (
              <>
                <h3 className="truncate text-lg font-semibold">
                  {currentStatus.displayName}
                </h3>
                <p className="text-text-secondary dark:text-text-dark-secondary mt-1 flex items-center gap-1.5 text-sm">
                  <span>{currentProviderConfig?.icon}</span>
                  <span>{currentProviderConfig?.name} 账号</span>
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">未登录</h3>
                <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-sm">
                  请选择一个登录方式
                </p>
              </>
            )}
          </div>
        </div>

        {/* 当前登录账号的操作 */}
        {currentProvider && (
          <div className="mt-4 border-t pt-4">
            <AuthProviderActions provider={currentProvider} isActive={true} />
          </div>
        )}
      </div>

      {/* 登录方式 */}
      <div>
        <h4 className="mb-3 text-sm font-medium">登录方式</h4>
        <div className="space-y-3">
          {AUTH_PROVIDERS.map((config) => {
            const isActive = currentProvider === config.provider
            return (
              <div
                key={config.provider}
                className="dark:bg-surface-dark-secondary rounded-xl border bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <p className="font-medium">{config.name}</p>
                      {isActive && (
                        <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
                          当前登录
                        </p>
                      )}
                    </div>
                  </div>
                  {!isActive && (
                    <AuthProviderActions
                      provider={config.provider}
                      isActive={false}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 说明 */}
      <div className="bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 rounded-lg p-4">
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs leading-relaxed">
          💡 这些账号用于登录 Livo 应用本身。如需关联第三方平台（B站、YouTube
          等）以获取订阅内容，请前往"账号关联"页面。
        </p>
      </div>
    </div>
  )
}

function AuthProviderActions({
  provider,
  isActive,
}: {
  provider: AccountProvider
  isActive: boolean
}) {
  const queryClient = useQueryClient()
  const statusQuery = useAccountStatusQuery(provider)
  const status = statusQuery.data ?? { linked: false, displayName: null }

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const refreshStatus = useCallback(
    () => refreshAccountStatus(provider, queryClient),
    [provider, queryClient],
  )

  const handleLink = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const result = window.api.accounts
        ? await window.api.accounts.link(provider)
        : {
            success: false,
            error: '当前版本未注入 accounts API，请重启应用后重试',
          }
      if (result.success) {
        setFeedback('登录成功')
        await refreshStatus()
      } else {
        setFeedback('登录失败')
        setErrorDetail(result.error ?? null)
      }
    } catch (err) {
      setFeedback('登录失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [provider, refreshStatus])

  const handleUnlink = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      const result = window.api.accounts
        ? await window.api.accounts.unlink(provider)
        : {
            success: false,
            error: '当前版本未注入 accounts API，请重启应用后重试',
          }
      if (result.success) {
        setFeedback('已退出登录')
        await refreshStatus()
      } else {
        setFeedback('退出失败')
        setErrorDetail(result.error ?? null)
      }
    } catch (err) {
      setFeedback('退出失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [provider, refreshStatus])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setFeedback(null)
    setErrorDetail(null)
    try {
      await refreshStatus()
      setFeedback('刷新成功')
    } catch (err) {
      setFeedback('刷新失败')
      setErrorDetail(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback(null), 3000)
    }
  }, [refreshStatus])

  if (loading || statusQuery.isLoading) {
    return (
      <div className="text-text-secondary flex items-center gap-1.5 text-xs">
        <Loader2 size={14} className="animate-spin" />
        处理中...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status.linked && status.displayName ? (
          <>
            {isActive && (
              <button
                onClick={handleUnlink}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                <LogOut size={14} />
                退出登录
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
            >
              <RefreshCw size={14} />
              刷新
            </button>
          </>
        ) : (
          <button
            onClick={handleLink}
            className="bg-accent hover:bg-accent-hover flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            <LogIn size={14} />
            登录
          </button>
        )}

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

      {errorDetail && <p className="text-xs text-red-500">{errorDetail}</p>}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../store/auth-store'

/**
 * 登录悬浮弹窗
 *
 * 场景：用户启动应用后未登录，显示居中悬浮的登录卡片
 * 行为：
 * - 检查本地 Session，有效则不显示
 * - 登录成功后自动关闭
 * - 不可跳过，必须登录后才能使用应用
 */
export function LoginModal() {
  const { isAuthenticated, isSessionChecked } = useAuthStore()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  // 监听登录进度事件
  useEffect(() => {
    const unsubscribe = window.api.auth.onLoginProgress(({ status }) => {
      setProgress(status)
    })
    return unsubscribe
  }, [])

  const handleGoogleLogin = useCallback(async () => {
    setIsLoggingIn(true)
    setError(null)
    setProgress('Opening browser...')

    try {
      const result = await window.api.auth.loginGoogle()

      if (result.success && result.user && result.token) {
        useAuthStore.getState().setUser(result.user, result.token)
        setProgress(null)
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoggingIn(false)
      setProgress(null)
    }
  }, [])

  const handleWechatLogin = useCallback(async () => {
    setIsLoggingIn(true)
    setError(null)
    setProgress('Opening browser...')

    try {
      const result = await window.api.auth.loginWechat()

      if (result.success && result.user && result.token) {
        useAuthStore.getState().setUser(result.user, result.token)
        setProgress(null)
      } else {
        setError(result.error || 'Login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoggingIn(false)
      setProgress(null)
    }
  }, [])

  // 不显示弹窗的情况
  if (!isSessionChecked || isAuthenticated) {
    return null
  }

  return (
    <div className="backdrop-animate fixed inset-0 z-[100] flex items-center justify-center">
      {/* 半透明蒙层 */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />

      {/* 登录卡片 */}
      <div className="login-card-animate border-border bg-surface dark:bg-surface-dark-secondary relative w-full max-w-md rounded-2xl border p-8 shadow-2xl dark:border-white/10 dark:shadow-black/50">
        {/* Logo 区域 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-text text-2xl font-semibold tracking-tight dark:text-white">
              Welcome to Livo
            </h1>
            <p className="text-text-secondary dark:text-text-dark-secondary mt-1.5 text-sm">
              Sign in to sync your feeds and preferences
            </p>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* 进度提示 */}
        {progress && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
            {progress}
          </div>
        )}

        {/* 登录按钮组 */}
        <div className="space-y-3">
          {/* Google 登录 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="border-border bg-elevated text-text hover:border-border/60 hover:bg-surface-secondary focus:ring-accent/30 dark:bg-surface-dark-tertiary dark:hover:bg-surface-dark-secondary group relative flex w-full items-center justify-center gap-3 rounded-xl border px-5 py-3.5 text-[15px] font-medium shadow-sm transition-all hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white"
          >
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
            <span>
              {isLoggingIn ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>

          {/* 微信登录 */}
          <button
            type="button"
            onClick={handleWechatLogin}
            disabled={isLoggingIn}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#07C160] px-5 py-3.5 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-[#06AD56] hover:shadow focus:outline-none focus:ring-2 focus:ring-[#07C160]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 1024 1024"
              fill="currentColor"
            >
              <path d="M680.832 390.656c10.24 0 20.48 0.512 30.208 1.536-27.136-126.464-162.304-220.672-317.44-220.672-175.616 0-318.464 119.808-318.464 267.264 0 86.528 47.104 157.696 125.952 213.504l-31.488 94.72 110.08-55.296c39.424 7.68 70.656 15.872 110.08 15.872 9.984 0 19.968-0.512 29.696-1.536-6.144-21.504-9.728-43.776-9.728-67.072 0.512-137.728 118.272-248.32 271.104-248.32z m-172.032-86.016c23.552 0 39.424 15.872 39.424 39.424s-15.872 39.424-39.424 39.424c-23.552 0-47.104-15.872-47.104-39.424s23.552-39.424 47.104-39.424z m-212.992 78.848c-23.552 0-47.104-15.872-47.104-39.424s23.552-39.424 47.104-39.424c23.552 0 39.424 15.872 39.424 39.424s-15.872 39.424-39.424 39.424z m606.72 114.176c0-126.464-126.464-229.376-267.264-229.376-148.48 0-267.776 102.912-267.776 229.376 0 126.976 119.296 229.376 267.776 229.376 31.488 0 63.488-7.68 94.72-15.872l86.528 47.104-23.552-78.848c63.488-47.104 109.568-110.08 109.568-181.76z m-356.352-39.424c-15.872 0-31.488-15.872-31.488-31.488s15.872-31.488 31.488-31.488c23.552 0 39.424 15.872 39.424 31.488s-15.872 31.488-39.424 31.488z m173.056 0c-15.872 0-31.488-15.872-31.488-31.488s15.872-31.488 31.488-31.488c23.552 0 39.424 15.872 39.424 31.488s-15.872 31.488-39.424 31.488z" />
            </svg>
            <span>
              {isLoggingIn ? 'Signing in...' : 'Continue with WeChat'}
            </span>
          </button>
        </div>

        {/* 底部文字 */}
        <div className="border-border mt-6 border-t pt-5 dark:border-white/5">
          <p className="text-text-tertiary dark:text-text-dark-secondary/70 text-center text-xs">
            By signing in, you agree to our Terms and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}

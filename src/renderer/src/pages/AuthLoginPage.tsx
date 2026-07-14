import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/auth-store'

export default function AuthLoginPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const { setUser, setLoading: setAuthLoading } = useAuthStore()

  // 监听登录进度
  useEffect(() => {
    const unsubscribe = window.api.auth.onLoginProgress(({ status }) => {
      setProgress(status)
    })

    return unsubscribe
  }, [])

  const handleWechatLogin = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress('Opening browser...')
    setAuthLoading(true)

    try {
      const result = await window.api.auth.loginWechat()

      if (result.success && result.user) {
        setUser(result.user)
        setProgress(null)
      } else {
        setError(result.error || 'Wechat login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wechat login failed')
    } finally {
      setLoading(false)
      setProgress(null)
      setAuthLoading(false)
    }
  }, [setUser, setAuthLoading])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Livo
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('auth.loginPrompt', {
              defaultValue: 'Please sign in to continue',
            })}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Progress Message */}
        {progress && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            {progress}
          </div>
        )}

        {/* Login Buttons */}
        <div className="space-y-3">
          {/* Wechat Login Button */}
          <button
            type="button"
            onClick={handleWechatLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.5 10.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm.5 2.5c0-2-1.5-3.5-3.5-3.5S9 11 9 13c0 .5.1 1 .3 1.5l-2.8 1.4c-.3.1-.4.5-.3.8.1.2.3.3.5.3h.1l3.3-1.1c.6.1 1.2.1 1.9.1 2 0 3.5-1.5 3.5-3.5zM23 12c0-5.5-5.4-10-12-10S-1 6.5-1 12c0 3.3 2 6.3 5 8.2-.2.7-.6 2-1 3.2-.1.3.1.6.4.7h.2c.2 0 .4-.1.5-.2 1.6-1.4 3.3-2.9 4.2-3.6.9.1 1.8.2 2.7.2 6.6 0 12-4.5 12-10z" />
            </svg>
            {loading
              ? t('auth.signingIn', { defaultValue: 'Signing in...' })
              : t('auth.signInWithWechat', {
                  defaultValue: 'Sign in with WeChat',
                })}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
          {t('auth.termsHint', {
            defaultValue: 'By signing in, you agree to our Terms of Service',
          })}
        </p>
      </div>
    </div>
  )
}

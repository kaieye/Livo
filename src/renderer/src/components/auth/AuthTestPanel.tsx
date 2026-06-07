import { useState } from 'react'
import { useAuthStore } from '../../store/auth-store'

/**
 * OAuth 测试面板 - 用于测试认证功能
 *
 * 使用方法：
 * 1. 点击 "Test Google Login" 测试 Google OAuth
 * 2. 点击 "Test WeChat Login" 测试微信 OAuth
 * 3. 点击 "Check Session" 检查当前登录状态
 * 4. 点击 "Logout" 登出
 *
 * 注意：需要在后端配置 Google OAuth 凭据才能完整测试
 */
export function AuthTestPanel() {
  const { isAuthenticated, user, logout, checkSession } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setLastAction('Google Login')
    setActionResult('Opening browser...')

    try {
      const result = await window.api.auth.loginGoogle()
      console.log('Google Login Result:', result)

      if (result.success && result.user) {
        setActionResult(`✅ Success! User: ${result.user.displayName}`)
        useAuthStore.getState().setUser(result.user, result.token)
      } else {
        setActionResult(`❌ Failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Google Login Error:', error)
      setActionResult(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleWechatLogin = async () => {
    setLoading(true)
    setLastAction('WeChat Login')
    setActionResult('Opening browser...')

    try {
      const result = await window.api.auth.loginWechat()
      console.log('WeChat Login Result:', result)

      if (result.success && result.user) {
        setActionResult(`✅ Success! User: ${result.user.displayName}`)
        useAuthStore.getState().setUser(result.user, result.token)
      } else {
        setActionResult(`❌ Failed: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('WeChat Login Error:', error)
      setActionResult(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCheckSession = async () => {
    setLoading(true)
    setLastAction('Check Session')
    setActionResult('Checking...')

    try {
      await checkSession()
      const state = useAuthStore.getState()

      if (state.isAuthenticated && state.user) {
        setActionResult(`✅ Session Valid! User: ${state.user.displayName}`)
      } else {
        setActionResult('❌ No valid session')
      }
    } catch (error) {
      console.error('Check Session Error:', error)
      setActionResult(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    setLastAction('Logout')
    setActionResult('Logging out...')

    try {
      await logout()
      setActionResult('✅ Logged out successfully')
    } catch (error) {
      console.error('Logout Error:', error)
      setActionResult(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="no-drag fixed right-5 top-20 z-[999] w-80 rounded-lg border-2 border-red-500 bg-white p-4 shadow-2xl dark:bg-gray-800"
      style={{ userSelect: 'text' }}
    >
      {/* Header */}
      <div className="mb-3 border-b border-gray-200 pb-2 dark:border-gray-700">
        <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
          🧪 OAuth Test Panel
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Test authentication flow
        </p>
      </div>

      {/* Status */}
      <div className="mb-3 rounded-md bg-gray-50 p-2 dark:bg-gray-900">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Status:
          </span>
          <span
            className={`font-bold ${
              isAuthenticated
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isAuthenticated ? '✅ Logged In' : '❌ Not Logged In'}
          </span>
        </div>
        {user && (
          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="truncate">
              <span className="font-medium">User:</span> {user.displayName}
            </div>
            <div className="truncate">
              <span className="font-medium">Role:</span> {user.role}
            </div>
            <div className="truncate">
              <span className="font-medium">ID:</span> {user.id}
            </div>
          </div>
        )}
      </div>

      {/* Last Action Result */}
      {actionResult && (
        <div className="mb-3 rounded-md bg-blue-50 p-2 dark:bg-blue-900/20">
          <div className="text-xs font-medium text-blue-900 dark:text-blue-200">
            {lastAction}:
          </div>
          <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            {actionResult}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="space-y-2">
        {!isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full rounded-md bg-blue-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && lastAction === 'Google Login'
                ? '⏳ Logging in...'
                : '🔐 Test Google Login'}
            </button>
            <button
              type="button"
              onClick={handleWechatLogin}
              disabled={loading}
              className="w-full rounded-md bg-green-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && lastAction === 'WeChat Login'
                ? '⏳ Logging in...'
                : '💬 Test WeChat Login'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="w-full rounded-md bg-red-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && lastAction === 'Logout'
              ? '⏳ Logging out...'
              : '🚪 Logout'}
          </button>
        )}

        <button
          type="button"
          onClick={handleCheckSession}
          disabled={loading}
          className="w-full rounded-md bg-gray-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && lastAction === 'Check Session'
            ? '⏳ Checking...'
            : '🔍 Check Session'}
        </button>
      </div>

      {/* Tips */}
      <div className="mt-3 rounded-md bg-yellow-50 p-2 dark:bg-yellow-900/20">
        <p className="text-xs text-yellow-800 dark:text-yellow-200">
          💡 <strong>Tip:</strong> Open DevTools Console to see detailed logs
        </p>
      </div>

      {/* Remove Instructions */}
      <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
        To remove: Delete{' '}
        <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">
          &lt;AuthTestPanel /&gt;
        </code>{' '}
        from App.tsx
      </div>
    </div>
  )
}

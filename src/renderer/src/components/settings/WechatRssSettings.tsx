import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Clock,
} from 'lucide-react'

const POLL_INTERVAL_MS = 5_000
const STORAGE_KEY_TOKEN = 'livo-wechat-mp-token'
const STORAGE_KEY_LOGGED_IN = 'livo-wechat-mp-logged-in'

function loadPersistedToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || ''
  } catch {
    return ''
  }
}

function savePersistedToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token)
    localStorage.setItem(STORAGE_KEY_LOGGED_IN, '1')
  } catch {
    // ignore
  }
}

function clearPersistedToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_LOGGED_IN)
  } catch {
    // ignore
  }
}

function formatExpiryTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return isoString
  }
}

export function WechatRssSettings() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [expiryTime, setExpiryTime] = useState<string | undefined>()
  const [isChecking, setIsChecking] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const API_BASE = window.api.serverUrl

  // Check login + expiry status from server
  const checkLoginStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/wechat-rss/qr/status`)
      if (res.ok) {
        const data = await res.json()
        setIsLoggedIn(data.isLoggedIn)
        setTokenExpired(data.tokenExpired || false)
        setExpiryTime(data.expiryTime)
      }
    } catch {
      // Server may not be running yet
    } finally {
      setIsChecking(false)
    }
  }, [API_BASE])

  // Start WeChat MP login via Electron
  const startLogin = useCallback(async () => {
    setError('')
    setIsLoggingIn(true)

    try {
      const result = await window.api.auth.wechatMpLogin()
      if (result?.token) {
        savePersistedToken(result.token)
        await checkLoginStatus()
      } else {
        throw new Error('未获取到登录凭证')
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('登录窗口已关闭')) {
        setError('登录已取消')
      } else {
        setError(e instanceof Error ? `登录失败: ${e.message}` : '登录失败')
      }
    } finally {
      setIsLoggingIn(false)
    }
  }, [checkLoginStatus])

  // Log out: clear token
  const handleLogout = useCallback(() => {
    clearPersistedToken()
    setIsLoggedIn(false)
    setTokenExpired(false)
    setExpiryTime(undefined)
    setError('')
    // Also clear token on server side
    fetch(`${API_BASE}/api/wechat-rss/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '', cookies: '' }),
    }).catch(() => {})
  }, [API_BASE])

  // On mount: re-send persisted token to server
  useEffect(() => {
    const persisted = loadPersistedToken()
    if (persisted) {
      fetch(`${API_BASE}/api/wechat-rss/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: persisted }),
      })
        .then(() => checkLoginStatus())
        .catch(() => {})
    }
  }, [API_BASE, checkLoginStatus])

  // Poll for login status changes
  useEffect(() => {
    pollRef.current = setInterval(checkLoginStatus, POLL_INTERVAL_MS)
    checkLoginStatus()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [checkLoginStatus])

  // Still checking server status
  if (isChecking) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
        <p className="text-sm text-neutral-400">正在检查授权状态…</p>
      </div>
    )
  }

  // Not logged in — show login prompt
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="#07C160"
              className="h-10 w-10"
            >
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.135 0 .243-.11.243-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.49.49 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              微信公众号授权
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              点击下方按钮，在弹出的微信公众平台页面扫码授权
            </p>
          </div>
          <button
            onClick={startLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 rounded-lg bg-[#07C160] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingIn ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                等待扫码...
              </>
            ) : (
              '授权登录'
            )}
          </button>
          {isLoggingIn && (
            <p className="text-xs text-neutral-400">
              请在打开的微信公众平台页面中使用微信扫码
            </p>
          )}
        </div>
      </div>
    )
  }

  // Logged in — show status with expiry info
  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Token expired warning */}
      {tokenExpired && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Token 已过期
            </p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              {expiryTime ? (
                <>
                  过期时间：{formatExpiryTime(expiryTime)}，请重新扫码授权以恢复
                  订阅更新
                </>
              ) : (
                '请重新扫码授权以恢复订阅更新'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Authorised status banner */}
      {!tokenExpired && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07C160]">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              微信已授权
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              公众号订阅源将正常更新
              {expiryTime && (
                <span className="ml-1 opacity-70">
                  · 有效期至 {formatExpiryTime(expiryTime)}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <p className="mb-2 text-xs font-medium text-neutral-500">授权操作</p>

        {/* Refresh token button — always available */}
        <button
          onClick={startLogin}
          disabled={isLoggingIn}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#07C160] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingIn ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              等待扫码...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              重新授权
            </>
          )}
        </button>
        {isLoggingIn && (
          <p className="text-center text-xs text-neutral-400">
            请在打开的微信公众平台页面中扫描二维码
          </p>
        )}

        {/* Expiry info */}
        {!isLoggingIn && expiryTime && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3 w-3" />
            {tokenExpired ? (
              <span className="text-amber-600 dark:text-amber-400">
                Token 已于 {formatExpiryTime(expiryTime)} 过期
              </span>
            ) : (
              <span>Token 有效期至 {formatExpiryTime(expiryTime)}</span>
            )}
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          注销授权
        </button>
      </div>
    </div>
  )
}

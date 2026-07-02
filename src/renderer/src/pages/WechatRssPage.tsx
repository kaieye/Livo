import { useState, useEffect, useCallback, useRef } from 'react'
import { WechatRssQrSection } from '../components/wechat-rss/WechatRssQrSection'
import { WechatRssSearchSection } from '../components/wechat-rss/WechatRssSearchSection'
import type { WechatQrStatus, WechatSearchResult } from '../lib/wechat-rss-api'

const POLL_INTERVAL_MS = 2_000

function getServerUrl(): string {
  return window.api.serverUrl || 'http://localhost:8787'
}

export default function WechatRssPage() {
  const [status, setStatus] = useState<WechatQrStatus>({
    isLoggedIn: false,
    qrPending: false,
    message: '加载中...',
  })
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [results, setResults] = useState<WechatSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const serverUrl = getServerUrl()

  // Poll QR status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/wechat-rss/qr/status`)
      const data: WechatQrStatus = await res.json()
      setStatus(data)

      if (data.qrPending && !qrImageUrl) {
        // Fetch QR image
        const imgRes = await fetch(`${serverUrl}/api/wechat-rss/qr/image`)
        const imgData = await imgRes.json()
        setQrImageUrl(imgData.base64Image || '')
      }

      if (data.isLoggedIn) {
        setQrImageUrl('')
      }
    } catch {
      setError('无法连接到 Livo Server')
    }
  }, [qrImageUrl, serverUrl])

  // Generate QR code
  const generateQr = useCallback(async () => {
    setError('')
    try {
      await fetch(`${serverUrl}/api/wechat-rss/qr/code`)
      await pollStatus()
    } catch {
      setError('生成二维码失败')
    }
  }, [pollStatus, serverUrl])

  // Polling
  useEffect(() => {
    pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS)
    pollStatus()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [pollStatus])

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setError('')
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        limit: '10',
        offset: '0',
      })
      const res = await fetch(
        `${serverUrl}/api/wechat-rss/search?${params.toString()}`,
      )
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setError('搜索失败')
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, serverUrl])

  const handleSubscribe = useCallback(
    async (item: WechatSearchResult) => {
      setError('')
      try {
        const res = await fetch(`${serverUrl}/api/wechat-rss/ensure-feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mpName: item.title,
            fakeId: item.fakeId,
            avatar: item.image,
            intro: item.description,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.message === 'string' ? data.message : '订阅失败')
          return
        }
        // Create local feed subscription to fetch articles
        if (data.rssUrl) {
          await window.api.feeds.add(
            data.rssUrl,
            undefined,
            undefined,
            data.title,
          )
        }
      } catch {
        setError('订阅失败')
      }
    },
    [serverUrl],
  )

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-neutral-950">
      {/* Header */}
      <div className="reader-titlebar-safe-pt border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <WechatIcon />
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              微信公众号 RSS
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {status.isLoggedIn
                ? '已授权 · 可搜索和订阅公众号'
                : status.message}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!status.isLoggedIn ? (
          <WechatRssQrSection
            status={status}
            qrImageUrl={qrImageUrl}
            onGenerateQr={generateQr}
          />
        ) : (
          <WechatRssSearchSection
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
            results={results}
            onSubscribe={handleSubscribe}
          />
        )}
      </div>
    </div>
  )
}

function WechatIcon() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#07C160]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="h-5 w-5"
      >
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.135 0 .243-.11.243-.245 0-.06-.024-.12-.04-.178l-.325-1.233a.49.49 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
      </svg>
    </div>
  )
}

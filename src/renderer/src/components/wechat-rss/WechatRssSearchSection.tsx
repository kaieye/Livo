import { useState } from 'react'
import { Search, Loader2, Plus, Rss, ExternalLink } from 'lucide-react'
import type { WechatSearchResult } from '../../lib/wechat-rss-api'

interface Props {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
  onSearch: () => void
  isSearching: boolean
  results: WechatSearchResult[]
  onSubscribe: (item: WechatSearchResult) => void
}

export function WechatRssSearchSection({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  isSearching,
  results,
  onSubscribe,
}: Props) {
  const [subscribingIds, setSubscribingIds] = useState<Set<string>>(new Set())

  const handleSubscribe = (item: WechatSearchResult) => {
    setSubscribingIds((prev) => new Set(prev).add(item.fakeId))
    Promise.resolve(onSubscribe(item))
      .catch(() => {})
      .finally(() => {
        setSubscribingIds((prev) => {
          const next = new Set(prev)
          next.delete(item.fakeId)
          return next
        })
      })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="搜索微信公众号名称..."
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#07C160] focus:outline-none focus:ring-1 focus:ring-[#07C160] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>
        <button
          onClick={onSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#07C160] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          搜索
        </button>
      </div>

      {/* Loading */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          <span className="ml-2 text-sm text-neutral-400">搜索中...</span>
        </div>
      )}

      {/* Results */}
      {!isSearching && results.length === 0 && searchQuery && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Search className="h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">未找到相关公众号</p>
          <p className="text-xs text-neutral-400">尝试其他关键词</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-400">
            找到 {results.length} 个结果
          </p>
          {results.map((item) => (
            <ResultRow
              key={item.fakeId}
              item={item}
              isSubscribing={subscribingIds.has(item.fakeId)}
              onSubscribe={() => handleSubscribe(item)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && !searchQuery && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <Rss className="h-8 w-8 text-[#07C160]" />
          </div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            搜索微信公众号
          </p>
          <p className="text-sm text-neutral-500">
            输入公众号名称搜索并订阅 RSS
          </p>
        </div>
      )}
    </div>
  )
}

function ResultRow({
  item,
  isSubscribing,
  onSubscribe,
}: {
  item: WechatSearchResult
  isSubscribing: boolean
  onSubscribe: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
      {/* Avatar */}
      <img
        src={item.image || undefined}
        alt={item.title}
        className="h-10 w-10 shrink-0 rounded-full bg-neutral-100 object-cover dark:bg-neutral-800"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {item.title}
          </span>
          <span className="shrink-0 rounded bg-[#07C160]/10 px-1.5 py-0.5 text-xs font-medium text-[#07C160]">
            微信
          </span>
        </div>
        {item.description && (
          <p className="truncate text-xs text-neutral-500">
            {item.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* RSS link */}
        {item.rssUrl && (
          <a
            href={item.rssUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
          >
            <ExternalLink className="h-3 w-3" />
            RSS
          </a>
        )}

        {/* Subscribe button */}
        <button
          onClick={onSubscribe}
          disabled={isSubscribing}
          className="inline-flex items-center gap-1 rounded-md bg-[#07C160] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubscribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          订阅
        </button>
      </div>
    </div>
  )
}

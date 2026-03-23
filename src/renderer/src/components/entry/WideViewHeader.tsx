import { CheckCheck, ChevronLeft, Eye, EyeOff, RefreshCw, Search } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import { FeedViewType, type ViewDefinition } from "../../../../shared/types"

export const WideViewHeader = memo(function WideViewHeader({
  activeView,
  inlineBilibili,
  title,
  viewDef,
  filterMode,
  isRefreshing,
  refreshProgress,
  searchQuery,
  onBack,
  onRefresh,
  onToggleUnreadFilter,
  onMarkAllRead,
  onSearch,
  onSearchQueryChange,
  onSetFilterMode,
}: {
  activeView: FeedViewType | null
  inlineBilibili: boolean
  title: string
  viewDef: ViewDefinition | null
  filterMode: "all" | "unread"
  isRefreshing: boolean
  refreshProgress?: {
    completed: number
    total: number
    percent: number
    feedTitle?: string
  } | null
  searchQuery: string
  onBack: () => void
  onRefresh: () => void | Promise<void>
  onToggleUnreadFilter: () => void
  onMarkAllRead: () => void
  onSearch: (e: React.FormEvent) => void
  onSearchQueryChange: (value: string) => void
  onSetFilterMode: (mode: "all" | "unread") => void
}) {
  const { t } = useTranslation()

  return (
    <div className={`flex-shrink-0 px-6 pt-3 pb-2 border-b ${activeView === FeedViewType.SocialMedia || activeView === FeedViewType.Pictures ? "" : "space-y-2.5"}`}>
      <div className="flex items-center justify-between">
        {inlineBilibili ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              className="inline-flex items-center gap-1.5 text-base font-semibold px-3 py-1.5 rounded-md border border-surface-tertiary dark:border-surface-dark-tertiary bg-surface-secondary/70 dark:bg-surface-dark-secondary/70 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              onClick={onBack}
              title={t("common.back")}
            >
              <ChevronLeft size={16} />
              {t("common.back")}
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-bold truncate flex items-center gap-2 leading-tight">
            {viewDef && <span className={viewDef.color}>{title}</span>}
            {!viewDef && title}
          </h2>
        )}
        {!inlineBilibili && (
          <div className="flex items-center gap-2 text-text-secondary dark:text-text-dark-secondary">
            <button
              onClick={() => void onRefresh()}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onToggleUnreadFilter}
              className={`p-1.5 rounded-lg transition-colors ${
                filterMode === "unread"
                  ? "text-accent bg-accent/10"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              }`}
              title={filterMode === "unread" ? t("common.all") : t("entryList.unread")}
            >
              {filterMode === "unread" ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              onClick={onMarkAllRead}
              className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              title={t("common.markAllRead")}
            >
              <CheckCheck size={16} />
            </button>
          </div>
        )}
      </div>

      {activeView !== FeedViewType.SocialMedia && activeView !== FeedViewType.Pictures && !inlineBilibili && (
        <div className="flex items-center gap-3 mt-2">
          <form onSubmit={onSearch} className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t("entryList.searchArticles")}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </form>

          <div className="flex gap-1 text-xs">
            <button
              onClick={() => onSetFilterMode("all")}
              className={`px-3 py-1 rounded-full transition-colors ${
                filterMode === "all"
                  ? "bg-accent text-white"
                  : "bg-surface-secondary dark:bg-surface-dark-secondary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {t("common.all")}
            </button>
            <button
              onClick={() => onSetFilterMode("unread")}
              className={`px-3 py-1 rounded-full transition-colors ${
                filterMode === "unread"
                  ? "bg-accent text-white"
                  : "bg-surface-secondary dark:bg-surface-dark-secondary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {t("entryList.unread")}
            </button>
          </div>

          {isRefreshing && refreshProgress && refreshProgress.total > 0 && (
            <div
              className="flex items-center gap-2 min-w-[220px] max-w-[360px] flex-1"
              title={refreshProgress.feedTitle || ""}
            >
              <span className="text-[11px] text-text-tertiary whitespace-nowrap">
                {`Refreshing ${refreshProgress.completed}/${refreshProgress.total}`}
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-surface-tertiary dark:bg-surface-dark-tertiary overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, refreshProgress.percent))}%` }}
                />
              </div>
              <span className="text-[11px] text-text-tertiary w-9 text-right shrink-0">
                {`${refreshProgress.percent}%`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

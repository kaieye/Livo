import { useState, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeedStore } from '../../store/feed-store'
import { useSettingsStore } from '../../store/settings-store'
import { openExternalUrlSafe } from '../../services/external-url'
import {
  FeedViewType,
  VIEW_DEFINITIONS,
  FEED_COLUMN_DEFAULTS,
} from '../../../../shared/types'
import type { FeedWithCount, FeedColumnId } from '../../../../shared/types'
import { VIEW_TYPE_I18N_KEYS } from '../../lib/view-type-keys'
import { RECOMMENDED_CATEGORY } from '../../hooks/useInitRecommendedFeeds'
import { getSafeImageSrc } from '../../lib/safe-image-source'
import {
  Trash2,
  Search,
  Edit3,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'

export function FeedsSettings() {
  const { feeds, removeFeed, removeFeeds, updateFeed } = useFeedStore()
  const receiveRecommended = useSettingsStore(
    (s) => s.settings.general.showRecommended,
  )
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editFolder, setEditFolder] = useState('')
  const [editView, setEditView] = useState<FeedViewType>(FeedViewType.Articles)
  const [editMaxEntries, setEditMaxEntries] = useState<number>(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [filterFolder, setFilterFolder] = useState<string | null>(null)

  // Column order from settings
  const rawFeedColumns = useSettingsStore((s) => s.settings.general.feedColumns)
  const feedColumns = useMemo(() => {
    const cols = rawFeedColumns
    if (!Array.isArray(cols) || cols.length === 0) return FEED_COLUMN_DEFAULTS
    const ids = new Set(cols.map((c) => c.id))
    const merged = [...cols]
    for (const d of FEED_COLUMN_DEFAULTS) {
      if (!ids.has(d.id)) merged.push({ ...d })
    }
    return merged
  }, [rawFeedColumns])
  const visibleColumns = useMemo(
    () => feedColumns.filter((c) => c.visible).map((c) => c.id),
    [feedColumns],
  )

  // Resizable column widths — keys are column ids
  const DEFAULT_WIDTHS: Record<FeedColumnId, number> = {
    category: 96,
    type: 64,
    maxEntries: 64,
    unread: 48,
    actions: 64,
  }
  const [colWidths, setColWidths] = useState<Record<FeedColumnId, number>>({
    ...DEFAULT_WIDTHS,
  })
  const resizeRef = useRef<{
    leftCol: FeedColumnId
    rightCol: FeedColumnId
    startX: number
    startLeft: number
    startRight: number
  } | null>(null)

  const onResizeStart = useCallback(
    (leftCol: FeedColumnId, rightCol: FeedColumnId, e: React.MouseEvent) => {
      e.preventDefault()
      const startLeft = colWidths[leftCol]
      const startRight = colWidths[rightCol]
      resizeRef.current = {
        leftCol,
        rightCol,
        startX: e.clientX,
        startLeft,
        startRight,
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: MouseEvent) => {
        const r = resizeRef.current
        if (!r) return
        const delta = ev.clientX - r.startX
        const newLeft = Math.max(32, r.startLeft + delta)
        const newRight = Math.max(32, r.startRight - delta)
        setColWidths((prev) => ({
          ...prev,
          [r.leftCol]: newLeft,
          [r.rightCol]: newRight,
        }))
      }
      const onUp = () => {
        resizeRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [colWidths],
  )

  // Column header/data config mapping
  const COLUMN_I18N: Record<FeedColumnId, string> = {
    category: 'settings.categoryHeader',
    type: 'settings.typeHeader',
    maxEntries: 'settings.maxEntriesHeader',
    unread: 'settings.unreadHeader',
    actions: 'settings.actionsHeader',
  }

  const visibleFeeds = useMemo(
    () =>
      receiveRecommended
        ? feeds
        : feeds.filter((f) => f.category !== RECOMMENDED_CATEGORY),
    [feeds, receiveRecommended],
  )

  const userFeeds = useMemo(
    () => visibleFeeds.filter((f) => f.category !== RECOMMENDED_CATEGORY),
    [visibleFeeds],
  )
  const recommendedFeeds = useMemo(
    () =>
      receiveRecommended
        ? visibleFeeds.filter((f) => f.category === RECOMMENDED_CATEGORY)
        : [],
    [visibleFeeds, receiveRecommended],
  )

  // All unique folders
  const folders = useMemo(() => {
    const cats = new Set<string>()
    for (const f of userFeeds)
      cats.add(f.folder || f.category || t('common.uncategorized'))
    return Array.from(cats).sort()
  }, [userFeeds, t])

  // Filtered user feeds
  const filteredUser = useMemo(() => {
    let list = userFeeds
    if (filterFolder) {
      list = list.filter(
        (f) =>
          (f.folder || f.category || t('common.uncategorized')) ===
          filterFolder,
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.url.toLowerCase().includes(q) ||
          (f.folder || f.category || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [userFeeds, search, filterFolder, t])

  // Recommended feeds in an independent list (only affected by search keyword)
  const filteredRecommended = useMemo(() => {
    if (!receiveRecommended) return []
    if (!search.trim()) return recommendedFeeds
    const q = search.toLowerCase()
    return recommendedFeeds.filter(
      (f) =>
        f.title.toLowerCase().includes(q) || f.url.toLowerCase().includes(q),
    )
  }, [recommendedFeeds, search, receiveRecommended])

  const allSelected =
    filteredUser.length > 0 && filteredUser.every((f) => selectedIds.has(f.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredUser.map((f) => f.id)))
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const startEdit = (feed: FeedWithCount) => {
    setEditingId(feed.id)
    setEditTitle(feed.title)
    setEditFolder(feed.folder || feed.category || '')
    setEditView(feed.view ?? FeedViewType.Articles)
    setEditMaxEntries(feed.maxEntries ?? 0)
  }

  const saveEdit = async () => {
    if (!editingId) return
    await updateFeed(editingId, {
      title: editTitle.trim() || undefined,
      folder: editFolder.trim(),
      view: editView,
      maxEntries: editMaxEntries > 0 ? editMaxEntries : undefined,
    })
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const handleDelete = async (id: string) => {
    await removeFeed(id)
    setConfirmDeleteId(null)
    selectedIds.delete(id)
    setSelectedIds(new Set(selectedIds))
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const feed = feeds.find((f) => f.id === id)
      return feed?.category !== RECOMMENDED_CATEGORY
    })
    await removeFeeds(ids)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
  }

  /** Render a single column cell for a feed row */
  const renderFeedColumn = (
    colId: FeedColumnId,
    feed: FeedWithCount,
    isRecommended: boolean,
  ) => {
    const w = colWidths[colId]
    switch (colId) {
      case 'category':
        return (
          <span
            key={colId}
            style={{ width: w }}
            className={`flex-shrink-0 truncate text-center text-xs ${isRecommended ? 'text-amber-700 dark:text-amber-300' : 'text-text-secondary dark:text-text-dark-secondary'}`}
          >
            {isRecommended
              ? t('sidebar.recommended')
              : feed.folder || feed.category || t('common.uncategorized')}
          </span>
        )
      case 'type':
        return (
          <span
            key={colId}
            style={{ width: w }}
            className={`flex-shrink-0 text-center text-xs ${VIEW_DEFINITIONS[feed.view ?? FeedViewType.Articles]?.color || ''}`}
          >
            {t(
              VIEW_TYPE_I18N_KEYS[feed.view ?? FeedViewType.Articles] ||
                'viewTypes.articles',
            )}
          </span>
        )
      case 'maxEntries':
        return (
          <span
            key={colId}
            style={{ width: w }}
            className="text-text-secondary dark:text-text-dark-secondary flex-shrink-0 text-center text-xs"
            title={t('settings.maxEntriesTip')}
          >
            {feed.maxEntries ? feed.maxEntries : t('settings.dataUnlimited')}
          </span>
        )
      case 'unread':
        return (
          <span
            key={colId}
            style={{ width: w }}
            className="flex-shrink-0 text-center text-xs"
          >
            {feed.unreadCount > 0 ? (
              <span className="bg-accent/10 text-accent inline-block rounded-full px-1.5 py-0.5 font-medium">
                {feed.unreadCount}
              </span>
            ) : (
              <span className="text-text-secondary dark:text-text-dark-secondary">
                0
              </span>
            )}
          </span>
        )
      case 'actions':
        return (
          <div
            key={colId}
            style={{ width: w }}
            className="flex flex-shrink-0 items-center justify-center gap-1"
          >
            {isRecommended ? (
              <span
                className="p-1 text-amber-500"
                title={t('settings.builtInFeed')}
              >
                <AlertCircle size={13} />
              </span>
            ) : (
              <>
                <button
                  onClick={() => startEdit(feed)}
                  className="hover:text-text-primary text-text-secondary hover:bg-surface-secondary dark:text-text-dark-secondary dark:hover:bg-surface-dark dark:hover:text-text-dark-primary rounded p-1"
                  title={t('common.edit')}
                >
                  <Edit3 size={13} />
                </button>
                {feed.siteUrl && (
                  <button
                    onClick={() => {
                      if (feed.siteUrl) {
                        void openExternalUrlSafe(feed.siteUrl)
                      }
                    }}
                    className="hover:text-text-primary text-text-secondary hover:bg-surface-secondary dark:text-text-dark-secondary dark:hover:bg-surface-dark dark:hover:text-text-dark-primary rounded p-1"
                    title={t('settings.visitWebsite')}
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
                {confirmDeleteId === feed.id ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleDelete(feed.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={t('settings.confirmDelete')}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark rounded p-1"
                      title={t('common.cancel')}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : feed.category === RECOMMENDED_CATEGORY ? (
                  <span
                    className="p-1 text-amber-500"
                    title={t('settings.builtInFeed')}
                  >
                    <AlertCircle size={13} />
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(feed.id)}
                    className="text-text-secondary dark:text-text-dark-secondary rounded p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    title={t('common.delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="text-text-secondary dark:text-text-dark-secondary absolute left-2.5 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder={t('settings.searchFeeds')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="focus:ring-accent dark:border-border-dark dark:bg-surface-dark w-full rounded-lg border bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={filterFolder || ''}
            onChange={(e) => setFilterFolder(e.target.value || null)}
            className="focus:ring-accent dark:border-border-dark dark:bg-surface-dark cursor-pointer appearance-none rounded-lg border bg-white py-1.5 pl-3 pr-7 text-sm focus:outline-none focus:ring-1"
          >
            <option value="">{t('settings.allCategories')}</option>
            {folders.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="text-text-secondary pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>

        {/* Bulk delete */}
        {selectedIds.size > 0 && (
          <button
            onClick={() => setConfirmBulkDelete(true)}
            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <Trash2 size={14} />
            {t('common.delete')} ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="text-text-secondary dark:text-text-dark-secondary flex flex-shrink-0 items-center gap-4 text-xs">
        <span>{t('settings.totalFeeds', { count: visibleFeeds.length })}</span>
        {filteredUser.length + filteredRecommended.length !==
          visibleFeeds.length && (
          <span>
            {t('settings.filteredFeeds', {
              count: filteredUser.length + filteredRecommended.length,
            })}
          </span>
        )}
        <span>
          {t('settings.unreadArticles', {
            count: feeds.reduce((s, f) => s + f.unreadCount, 0),
          })}
        </span>
      </div>

      {/* Feed list */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto">
        {/* Header row */}
        <div className="text-text-secondary dark:bg-surface-dark-secondary dark:text-text-dark-secondary sticky top-0 z-10 flex items-center gap-0 border-b bg-white px-2 py-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="accent-accent mr-2 flex-shrink-0 rounded"
          />
          <span className="min-w-0 flex-1">{t('settings.feedsHeader')}</span>
          {visibleColumns.map((colId, idx) => {
            const nextCol = visibleColumns[idx + 1]
            return (
              <span
                key={colId}
                style={{ width: colWidths[colId] }}
                className="relative flex-shrink-0 select-none text-center"
              >
                {colId === 'maxEntries' ? (
                  <span title={t('settings.maxEntriesHeaderTip')}>
                    {t(COLUMN_I18N[colId])}
                  </span>
                ) : (
                  t(COLUMN_I18N[colId])
                )}
                {nextCol && (
                  <div
                    className="group absolute -right-px bottom-1 top-1 z-10 flex w-[3px] cursor-col-resize items-center justify-center"
                    onMouseDown={(e) => onResizeStart(colId, nextCol, e)}
                  >
                    <div className="bg-border/60 group-hover:bg-accent/60 dark:bg-border-dark/60 h-full w-px transition-colors" />
                  </div>
                )}
              </span>
            )
          })}
        </div>

        {filteredUser.length + filteredRecommended.length === 0 ? (
          <div className="text-text-secondary dark:text-text-dark-secondary py-8 text-center text-sm">
            {search || filterFolder
              ? t('settings.noMatchingFeeds')
              : t('settings.noFeeds')}
          </div>
        ) : (
          <>
            {filteredUser.map((feed) => {
              const safeFeedImageUrl = getSafeImageSrc(feed.imageUrl)
              return (
                <div
                  key={feed.id}
                  className={`border-border/30 hover:bg-surface-secondary/50 dark:border-border-dark/30 dark:hover:bg-surface-dark/50 flex items-center gap-0 border-b px-2 py-2 text-sm transition-colors ${
                    selectedIds.has(feed.id)
                      ? 'bg-accent/5 dark:bg-accent/10'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(feed.id)}
                    onChange={() => toggleOne(feed.id)}
                    className="accent-accent mr-2 flex-shrink-0 rounded"
                  />

                  {editingId === feed.id ? (
                    /* Edit mode */
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="focus:ring-accent dark:border-border-dark dark:bg-surface-dark min-w-0 flex-1 rounded border bg-white px-2 py-0.5 text-sm focus:outline-none focus:ring-1"
                        placeholder={t('settings.titlePlaceholder')}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                      <input
                        value={editFolder}
                        onChange={(e) => setEditFolder(e.target.value)}
                        className="focus:ring-accent dark:border-border-dark dark:bg-surface-dark w-24 rounded border bg-white px-2 py-0.5 text-sm focus:outline-none focus:ring-1"
                        placeholder={t('settings.category')}
                      />
                      <select
                        value={editView}
                        onChange={(e) =>
                          setEditView(Number(e.target.value) as FeedViewType)
                        }
                        className="dark:border-border-dark dark:bg-surface-dark w-16 rounded border bg-white px-1 py-0.5 text-xs focus:outline-none"
                      >
                        {Object.entries(VIEW_DEFINITIONS).map(([k]) => (
                          <option key={k} value={k}>
                            {t(
                              VIEW_TYPE_I18N_KEYS[Number(k)] ||
                                'viewTypes.articles',
                            )}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editMaxEntries}
                        onChange={(e) =>
                          setEditMaxEntries(
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        className="focus:ring-accent dark:border-border-dark dark:bg-surface-dark w-16 rounded border bg-white px-1 py-0.5 text-center text-xs focus:outline-none focus:ring-1"
                        placeholder={t('settings.maxEntriesPlaceholder')}
                        title={t('settings.maxEntriesTip')}
                      />
                      <button
                        onClick={saveEdit}
                        className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark rounded p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    /* Display mode */
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {safeFeedImageUrl ? (
                            <img
                              src={safeFeedImageUrl}
                              className="h-4 w-4 flex-shrink-0 rounded"
                              alt=""
                            />
                          ) : null}
                          <span className="truncate font-medium">
                            {feed.title}
                          </span>
                          {feed.errorCount > 0 && (
                            <span
                              title={t('settings.fetchErrors', {
                                count: feed.errorCount,
                              })}
                            >
                              <AlertCircle
                                size={12}
                                className="flex-shrink-0 text-amber-500"
                              />
                            </span>
                          )}
                        </div>
                        <div className="text-text-secondary dark:text-text-dark-secondary mt-0.5 truncate text-xs">
                          {feed.url}
                        </div>
                      </div>
                      {visibleColumns.map((colId) =>
                        renderFeedColumn(colId, feed, false),
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {receiveRecommended && filteredRecommended.length > 0 && (
              <div className="mt-2">
                <div className="border-b border-t bg-amber-50/60 px-2 py-1.5 text-xs font-medium text-amber-600 dark:bg-amber-900/10 dark:text-amber-400">
                  {t('sidebar.recommended')}
                </div>
                {filteredRecommended.map((feed) => {
                  const safeFeedImageUrl = getSafeImageSrc(feed.imageUrl)
                  return (
                    <div
                      key={feed.id}
                      className="border-border/30 dark:border-border-dark/30 flex items-center gap-0 border-b bg-amber-50/20 px-2 py-2 text-sm dark:bg-amber-900/5"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        className="accent-accent mr-2 flex-shrink-0 rounded opacity-40"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {safeFeedImageUrl ? (
                            <img
                              src={safeFeedImageUrl}
                              className="h-4 w-4 flex-shrink-0 rounded"
                              alt=""
                            />
                          ) : null}
                          <span className="truncate font-medium">
                            {feed.title}
                          </span>
                        </div>
                        <div className="text-text-secondary dark:text-text-dark-secondary mt-0.5 truncate text-xs">
                          {feed.url}
                        </div>
                      </div>
                      {visibleColumns.map((colId) =>
                        renderFeedColumn(colId, feed, true),
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk delete confirmation */}
      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
          onClick={() => setConfirmBulkDelete(false)}
        >
          <div
            className="dark:bg-surface-dark-secondary w-[360px] space-y-4 rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              {t('settings.confirmDelete')}
            </h3>
            <p className="text-text-secondary dark:text-text-dark-secondary text-sm">
              {t('settings.confirmBulkDelete', { count: selectedIds.size })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBulkDelete(false)}
                className="hover:bg-surface-secondary dark:hover:bg-surface-dark rounded-lg border px-4 py-1.5 text-sm transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

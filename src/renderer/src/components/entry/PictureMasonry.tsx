import { memo, useMemo } from "react"
import { formatDistanceToNow, type Locale } from "date-fns"
import { Image } from "lucide-react"

import type { Entry, Feed } from "../../../../shared/types"
import { blurhashToAverageColor } from "../../lib/blurhash"
import type { MasonryCardData } from "../../lib/picture-masonry"

const MasonryCard = memo(function MasonryCard({
  data,
  feedTitle,
  feedImage,
  onClick,
  onContextMenu,
  locale,
  eager,
}: {
  data: MasonryCardData
  feedTitle?: string
  feedImage?: string
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  locale: Locale | undefined
  eager?: boolean
}) {
  const timeAgo = useMemo(() => {
    if (!data.publishedAt) return ""
    return formatDistanceToNow(new Date(data.publishedAt), { addSuffix: true, locale })
  }, [data.publishedAt, locale])
  const hasAspectRatio = !!(data.width && data.height)
  const aspectRatio = hasAspectRatio ? `${data.width} / ${data.height}` : undefined
  const placeholderColor = data.blurhash ? blurhashToAverageColor(data.blurhash) : undefined

  return (
    <div
      className="cursor-pointer group"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div
        className="relative rounded-xl overflow-hidden bg-surface-tertiary dark:bg-surface-dark-tertiary"
        style={{
          aspectRatio,
          backgroundColor: placeholderColor,
        }}
      >
        <img
          src={data.firstImage}
          alt=""
          className={hasAspectRatio
            ? "absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            : "block h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const parent = e.currentTarget.closest(".group") as HTMLElement | null
            if (parent) parent.style.display = "none"
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-end gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {feedImage ? (
                <img
                  src={feedImage}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              ) : null}
              <span className="text-[11px] text-white/90 truncate font-medium min-w-0">
                {feedTitle || ""}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end flex-shrink-0">
              {data.photoCount > 1 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white/80">
                  <Image size={9} />
                  {data.photoCount}
                </span>
              )}
              {timeAgo && (
                <span className="text-[10px] text-white/60 whitespace-nowrap">{timeAgo}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export const PictureMasonry = memo(function PictureMasonry({
  columns,
  isReady,
  isVisible,
  allCount,
  visibleCount,
  feedById,
  entryById,
  locale,
  onClickEntry,
  onContextMenu,
}: {
  columns: MasonryCardData[][]
  isReady: boolean
  isVisible: boolean
  allCount: number
  visibleCount: number
  feedById: Map<string, Feed>
  entryById: Map<string, Entry>
  locale: Locale | undefined
  onClickEntry: (entry: Entry) => void
  onContextMenu: (e: React.MouseEvent, entryId: string) => void
}) {
  if (!isReady) return null

  return (
    <>
      <div
        className="flex gap-2.5 transition-opacity duration-200"
        style={{ opacity: isVisible ? 1 : 0 }}
      >
        {columns.map((colCards, colIdx) => (
          <div key={colIdx} className="flex-1 flex flex-col gap-2.5 min-w-0">
            {colCards.map((card, rowIdx) => {
              const feed = feedById.get(card.feedId)
              return (
                <MasonryCard
                  key={card.id}
                  data={card}
                  feedTitle={feed?.title}
                  feedImage={feed?.imageUrl}
                  eager={colIdx < 2 && rowIdx < 2}
                  onClick={() => {
                    const entry = entryById.get(card.id)
                    if (entry) onClickEntry(entry)
                  }}
                  onContextMenu={(e) => onContextMenu(e, card.id)}
                  locale={locale}
                />
              )
            })}
          </div>
        ))}
      </div>
      {visibleCount < allCount && (
        <div className="py-3 text-center text-xs text-text-tertiary">
          {`${visibleCount}/${allCount}...`}
        </div>
      )}
    </>
  )
})

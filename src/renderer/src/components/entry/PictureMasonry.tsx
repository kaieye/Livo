import { memo, useMemo } from 'react'
import { formatDistanceToNow, type Locale } from 'date-fns'
import { Image } from 'lucide-react'

import type { Entry, Feed } from '../../../../shared/types'
import { blurhashToAverageColor } from '../../lib/blurhash'
import type { MasonryCardData } from '../../lib/picture-masonry'
import { CachedImage } from '../ui/CachedImage'

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
    if (!data.publishedAt) return ''
    return formatDistanceToNow(new Date(data.publishedAt), {
      addSuffix: true,
      locale,
    })
  }, [data.publishedAt, locale])
  const hasAspectRatio = !!(data.width && data.height)
  const aspectRatio = hasAspectRatio
    ? `${data.width} / ${data.height}`
    : undefined
  const placeholderColor = data.blurhash
    ? blurhashToAverageColor(data.blurhash)
    : undefined

  return (
    <div
      className="group cursor-pointer"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div
        className="bg-surface-tertiary dark:bg-surface-dark-tertiary relative overflow-hidden rounded-xl"
        style={{
          aspectRatio,
          backgroundColor: placeholderColor,
        }}
      >
        <CachedImage
          src={data.firstImage}
          alt=""
          className={
            hasAspectRatio
              ? 'absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]'
              : 'block h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]'
          }
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const parent = e.currentTarget.closest(
              '.group',
            ) as HTMLElement | null
            if (parent) parent.style.display = 'none'
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
          <div className="flex items-end gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              {feedImage ? (
                <CachedImage
                  src={feedImage}
                  alt=""
                  className="h-4 w-4 flex-shrink-0 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
              <span className="min-w-0 truncate text-[11px] font-medium text-white/90">
                {feedTitle || ''}
              </span>
            </div>
            <div className="ml-auto flex flex-shrink-0 flex-col items-end">
              {data.photoCount > 1 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white/80">
                  <Image size={9} />
                  {data.photoCount}
                </span>
              )}
              {timeAgo && (
                <span className="whitespace-nowrap text-[10px] text-white/60">
                  {timeAgo}
                </span>
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
          <div key={colIdx} className="flex min-w-0 flex-1 flex-col gap-2.5">
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
        <div className="text-text-tertiary py-3 text-center text-xs">
          {`${visibleCount}/${allCount}...`}
        </div>
      )}
    </>
  )
})

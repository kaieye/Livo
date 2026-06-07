import { Maximize2 } from 'lucide-react'

export function EntryFeaturedImage({
  imageUrl,
  title,
  onOpen,
}: {
  imageUrl: string
  title: string
  onOpen: () => void
}) {
  return (
    <div className="group/featured relative -mx-2 mb-8 overflow-hidden rounded-xl">
      <img
        src={imageUrl}
        alt=""
        className="max-h-[400px] w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
        loading="lazy"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        title={title}
        aria-label={title}
        className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover/featured:opacity-100"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  )
}

import {
  forwardRef,
  useMemo,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'
import {
  getRememberedImageMetadata,
  loadPersistedImageMetadata,
  rememberImageMetadata,
} from '../../lib/image-metadata'

type CachedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  preserveAspectRatio?: boolean
}

export const CachedImage = forwardRef<HTMLImageElement, CachedImageProps>(
  function CachedImage(
    { src, style, onLoad, preserveAspectRatio = false, ...props },
    ref,
  ) {
    loadPersistedImageMetadata()
    const remembered = useMemo(
      () =>
        typeof src === 'string' ? getRememberedImageMetadata(src) : undefined,
      [src],
    )
    const [localAspectRatio, setLocalAspectRatio] = useState<
      string | undefined
    >(() =>
      remembered ? `${remembered.width} / ${remembered.height}` : undefined,
    )

    const mergedStyle =
      preserveAspectRatio && localAspectRatio
        ? { ...style, aspectRatio: localAspectRatio }
        : style

    const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
      if (
        typeof src === 'string' &&
        rememberImageMetadata(src, {
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      ) {
        const next = getRememberedImageMetadata(src)
        if (next) {
          setLocalAspectRatio(`${next.width} / ${next.height}`)
        }
      }
      onLoad?.(event)
    }

    return (
      <img
        ref={ref}
        src={src}
        style={mergedStyle}
        onLoad={handleLoad}
        {...props}
      />
    )
  },
)

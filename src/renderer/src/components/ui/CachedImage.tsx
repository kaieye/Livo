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
import { getSafeImageSrc } from '../../lib/safe-image-source'

type CachedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  preserveAspectRatio?: boolean
}

export const CachedImage = forwardRef<HTMLImageElement, CachedImageProps>(
  function CachedImage(
    { src, style, onLoad, preserveAspectRatio = false, ...props },
    ref,
  ) {
    loadPersistedImageMetadata()
    const safeSrc = getSafeImageSrc(src)
    const remembered = useMemo(
      () =>
        typeof safeSrc === 'string'
          ? getRememberedImageMetadata(safeSrc)
          : undefined,
      [safeSrc],
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
        typeof safeSrc === 'string' &&
        rememberImageMetadata(safeSrc, {
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      ) {
        const next = getRememberedImageMetadata(safeSrc)
        if (next) {
          setLocalAspectRatio(`${next.width} / ${next.height}`)
        }
      }
      onLoad?.(event)
    }

    return (
      <img
        ref={ref}
        src={safeSrc}
        style={mergedStyle}
        onLoad={handleLoad}
        {...props}
      />
    )
  },
)

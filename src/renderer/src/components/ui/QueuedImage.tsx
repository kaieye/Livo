import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'
import { previewImageLoadQueue } from '../../lib/image-load-queue'
import { getSafeImageSrc } from '../../lib/safe-image-source'

type QueuedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
  rootMargin?: string
  eager?: boolean
}

export const QueuedImage = forwardRef<HTMLImageElement, QueuedImageProps>(
  function QueuedImage(
    { src, rootMargin = '160px', eager = false, onLoad, onError, ...props },
    forwardedRef,
  ) {
    const imgRef = useRef<HTMLImageElement | null>(null)
    const releaseActiveRef = useRef<(() => void) | null>(null)
    const safeSrc = useMemo(() => getSafeImageSrc(src), [src])
    const [isVisible, setIsVisible] = useState(eager)
    const [activeSrc, setActiveSrc] = useState<string | undefined>(
      eager ? safeSrc : undefined,
    )

    const releaseActive = useCallback(() => {
      releaseActiveRef.current?.()
      releaseActiveRef.current = null
    }, [])

    const setRefs = useCallback(
      (node: HTMLImageElement | null) => {
        imgRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    useEffect(() => {
      releaseActive()
      setActiveSrc(undefined)
      setIsVisible(eager)

      const element = imgRef.current
      if (!safeSrc || eager) return
      if (!element || typeof IntersectionObserver === 'undefined') {
        setIsVisible(true)
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          setIsVisible(true)
          observer.disconnect()
        },
        { rootMargin },
      )
      observer.observe(element)

      return () => {
        observer.disconnect()
      }
    }, [eager, releaseActive, rootMargin, safeSrc])

    useEffect(() => {
      if (!safeSrc || !isVisible) return
      if (eager) {
        setActiveSrc(safeSrc)
        return
      }

      let cancelled = false
      const cancelQueue = previewImageLoadQueue.request((ticket) => {
        if (cancelled) {
          ticket.release()
          return
        }
        releaseActiveRef.current = ticket.release
        setActiveSrc(safeSrc)
      })

      return () => {
        cancelled = true
        cancelQueue()
        releaseActive()
      }
    }, [eager, isVisible, releaseActive, safeSrc])

    const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
      releaseActive()
      onLoad?.(event)
    }

    const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
      releaseActive()
      onError?.(event)
    }

    return (
      <img
        ref={setRefs}
        src={activeSrc}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    )
  },
)

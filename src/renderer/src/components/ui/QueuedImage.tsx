import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react'
import { previewImageLoadQueue } from '../../lib/image-load-queue'

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
    const [isVisible, setIsVisible] = useState(eager)
    const [activeSrc, setActiveSrc] = useState<string | undefined>(
      eager ? src : undefined,
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
      if (!src || eager) return
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
    }, [eager, releaseActive, rootMargin, src])

    useEffect(() => {
      if (!src || !isVisible) return
      if (eager) {
        setActiveSrc(src)
        return
      }

      let cancelled = false
      const cancelQueue = previewImageLoadQueue.request((ticket) => {
        if (cancelled) {
          ticket.release()
          return
        }
        releaseActiveRef.current = ticket.release
        setActiveSrc(src)
      })

      return () => {
        cancelled = true
        cancelQueue()
        releaseActive()
      }
    }, [eager, isVisible, releaseActive, src])

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

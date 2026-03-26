import { useEffect, type PropsWithChildren } from 'react'
import { useOverlayStackStore } from '../store/overlay-stack-store'

export function OverlayStackProvider({ children }: PropsWithChildren) {
  const stack = useOverlayStackStore((state) => state.stack)

  useEffect(() => {
    document.body.dataset.overlayOpen = stack.length > 0 ? 'true' : 'false'
    return () => {
      delete document.body.dataset.overlayOpen
    }
  }, [stack])

  return children
}

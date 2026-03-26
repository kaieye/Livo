import { useEffect, useState, type RefObject } from "react"

import { subscribeLayoutFocus, type LayoutFocusTarget } from "../lib/layout-focus"

export function useLayoutFocusTarget(
  target: LayoutFocusTarget,
  ref: RefObject<HTMLElement | null>,
) {
  const [isHighlighted, setIsHighlighted] = useState(false)

  useEffect(() => {
    let timeoutId: number | null = null

    const unsubscribe = subscribeLayoutFocus((nextTarget) => {
      if (nextTarget !== target) return
      const element = ref.current
      if (!element) return
      element.focus({ preventScroll: false })
      setIsHighlighted(true)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        setIsHighlighted(false)
      }, 1200)
    })
    return () => {
      unsubscribe()
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [ref, target])

  return isHighlighted
}

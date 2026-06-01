export type LayoutFocusTarget = 'sidebar' | 'content'

const LAYOUT_FOCUS_EVENT = 'livo:layout-focus'

export function requestLayoutFocus(target: LayoutFocusTarget) {
  window.dispatchEvent(
    new CustomEvent<LayoutFocusTarget>(LAYOUT_FOCUS_EVENT, { detail: target }),
  )
}

export function subscribeLayoutFocus(
  listener: (target: LayoutFocusTarget) => void,
) {
  const handle = (event: Event) => {
    const customEvent = event as CustomEvent<LayoutFocusTarget>
    if (!customEvent.detail) return
    listener(customEvent.detail)
  }
  window.addEventListener(LAYOUT_FOCUS_EVENT, handle)
  return () => window.removeEventListener(LAYOUT_FOCUS_EVENT, handle)
}

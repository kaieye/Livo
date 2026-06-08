import { useLayoutEffect, useRef } from 'react'

const VIEW_PANEL_TRANSITION_ENTER_CLASS = 'view-transition-panel-enter'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface ViewPanelMotionEnvironment {
  rootClassList?: Pick<DOMTokenList, 'contains'> | null
  matchMedia?: ((query: string) => Pick<MediaQueryList, 'matches'>) | null
}

export function shouldReduceViewPanelMotion(
  environment: ViewPanelMotionEnvironment = {},
): boolean {
  const rootClassList =
    environment.rootClassList ??
    (typeof document !== 'undefined'
      ? document.documentElement.classList
      : null)

  if (rootClassList?.contains('reduce-motion')) return true

  const matchMedia =
    environment.matchMedia ??
    (typeof window !== 'undefined' ? window.matchMedia : null)

  return matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
}

export function useViewPanelTransition(transitionKey: string) {
  const panelRef = useRef<HTMLDivElement>(null)
  const prevTransitionKeyRef = useRef<string | null>(null)

  // 栏目切换只重播内容进入动画，不重挂载面板子树，避免三栏布局在中间态塌缩。
  useLayoutEffect(() => {
    if (prevTransitionKeyRef.current === null) {
      prevTransitionKeyRef.current = transitionKey
      return
    }

    if (prevTransitionKeyRef.current === transitionKey) return
    prevTransitionKeyRef.current = transitionKey

    const panel = panelRef.current
    if (!panel) return

    panel.classList.remove(VIEW_PANEL_TRANSITION_ENTER_CLASS)
    if (shouldReduceViewPanelMotion()) return

    void panel.offsetWidth
    panel.classList.add(VIEW_PANEL_TRANSITION_ENTER_CLASS)

    const clearTransitionClass = (event: AnimationEvent) => {
      if (event.target !== panel) return
      panel.classList.remove(VIEW_PANEL_TRANSITION_ENTER_CLASS)
    }

    panel.addEventListener('animationend', clearTransitionClass)
    panel.addEventListener('animationcancel', clearTransitionClass)

    return () => {
      panel.removeEventListener('animationend', clearTransitionClass)
      panel.removeEventListener('animationcancel', clearTransitionClass)
      panel.classList.remove(VIEW_PANEL_TRANSITION_ENTER_CLASS)
    }
  }, [transitionKey])

  return panelRef
}

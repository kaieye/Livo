import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getTransitionKey } from '../../lib/page-transition'

/**
 * Wraps the router `<Outlet />` and plays a short enter animation whenever the
 * navigation crosses into a different page group (see `getTransitionKey`).
 *
 * Switching the `key` remounts the subtree, which re-triggers the CSS keyframe.
 * Home-family routes keep a stable key so view-type switches stay instant and
 * the heavy HomePage is not remounted. The animation is automatically disabled
 * by the global `.reduce-motion` rule in `globals.css`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const transitionKey = getTransitionKey(pathname)

  return (
    <div key={transitionKey} className="page-transition h-full w-full">
      {children}
    </div>
  )
}

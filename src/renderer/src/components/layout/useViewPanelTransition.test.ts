import { describe, expect, it } from 'vitest'
import { shouldReduceViewPanelMotion } from './useViewPanelTransition'

describe('shouldReduceViewPanelMotion', () => {
  it('uses the app reduce-motion class first', () => {
    expect(
      shouldReduceViewPanelMotion({
        rootClassList: {
          contains: (className) => className === 'reduce-motion',
        },
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(true)
  })

  it('uses the system reduced-motion preference', () => {
    expect(
      shouldReduceViewPanelMotion({
        rootClassList: {
          contains: () => false,
        },
        matchMedia: () => ({ matches: true }),
      }),
    ).toBe(true)
  })

  it('keeps animation enabled when no reduced-motion source is active', () => {
    expect(
      shouldReduceViewPanelMotion({
        rootClassList: {
          contains: () => false,
        },
        matchMedia: () => ({ matches: false }),
      }),
    ).toBe(false)
  })
})

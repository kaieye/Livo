import { describe, expect, it } from 'vitest'
import { clampWindowBounds } from './window-state'

describe('window state', () => {
  it('clamps restored bounds inside the current display work area', () => {
    expect(
      clampWindowBounds(
        { x: 1800, y: 1200, width: 1280, height: 800 },
        { x: 0, y: 0, width: 1440, height: 900 },
      ),
    ).toEqual({ x: 160, y: 100, width: 1280, height: 800 })
  })

  it('keeps the minimum window size even when saved bounds are too small', () => {
    expect(
      clampWindowBounds(
        { x: 20, y: 30, width: 100, height: 200 },
        { x: 0, y: 0, width: 1440, height: 900 },
      ),
    ).toEqual({ x: 20, y: 30, width: 900, height: 600 })
  })
})

import { describe, expect, it } from 'vitest'
import {
  getDefaultPanelRatio,
  panelPixelsToRatio,
  ratioToPanelPixels,
} from './useAIChatPanelGeometry'

describe('AI chat panel geometry', () => {
  it('clamps stored ratio dimensions and position into the current viewport', () => {
    const pixels = ratioToPanelPixels(
      { rx: 2, ry: -1, rw: 2, rh: 2 },
      { width: 1024, height: 768 },
    )

    expect(pixels.width).toBe(800)
    expect(pixels.height).toBe(728)
    expect(pixels.x).toBe(224)
    expect(pixels.y).toBe(0)
  })

  it('keeps the default panel inside the viewport with the existing margin', () => {
    const ratio = getDefaultPanelRatio({ width: 1440, height: 900 })
    const pixels = ratioToPanelPixels(ratio, { width: 1440, height: 900 })

    expect(pixels.x + pixels.width).toBeLessThanOrEqual(1420)
    expect(pixels.y + pixels.height).toBeLessThanOrEqual(880)
  })

  it('round-trips pixels through ratio for stable persistence', () => {
    const viewport = { width: 1280, height: 800 }
    const ratio = panelPixelsToRatio(
      { x: 700, y: 120, width: 480, height: 600 },
      viewport,
    )

    expect(ratioToPanelPixels(ratio, viewport)).toEqual({
      x: 700,
      y: 120,
      width: 480,
      height: 600,
    })
  })
})

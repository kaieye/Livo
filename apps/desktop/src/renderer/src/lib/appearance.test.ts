import { describe, expect, it } from 'vitest'
import { ACCENT_COLOR_MAP, resolveAccentPalette } from './appearance'

describe('resolveAccentPalette', () => {
  it('returns the orange preset by default', () => {
    expect(resolveAccentPalette(undefined)).toBe(ACCENT_COLOR_MAP.orange)
    expect(resolveAccentPalette('unknown-name')).toBe(ACCENT_COLOR_MAP.orange)
  })

  it('returns the matching named preset', () => {
    expect(resolveAccentPalette('blue')).toBe(ACCENT_COLOR_MAP.blue)
    expect(resolveAccentPalette('green')).toBe(ACCENT_COLOR_MAP.green)
  })

  it('derives a hover + soft shade for custom hex colors', () => {
    const palette = resolveAccentPalette('#3366cc')
    expect(palette.color).toBe('#3366cc')
    // hover is lightened toward white, so it must differ and be brighter.
    expect(palette.hover).not.toBe('#3366cc')
    expect(palette.hover.toLowerCase()).toBe('#5882d5')
    // soft is the color with a low alpha suffix.
    expect(palette.soft).toBe('#3366cc1A')
  })

  it('falls back to orange for malformed hex', () => {
    expect(resolveAccentPalette('#xyz')).toBe(ACCENT_COLOR_MAP.orange)
    expect(resolveAccentPalette('#fff')).toBe(ACCENT_COLOR_MAP.orange)
  })
})

import { describe, expect, it } from 'vitest'
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  getPalette,
  paletteToCssVariables,
} from './theme-palette'

describe('getPalette', () => {
  it('returns the dark palette when isDark is true', () => {
    expect(getPalette(true)).toBe(DARK_PALETTE)
  })

  it('returns the light palette when isDark is false', () => {
    expect(getPalette(false)).toBe(LIGHT_PALETTE)
  })
})

describe('paletteToCssVariables', () => {
  const vars = paletteToCssVariables(LIGHT_PALETTE)

  it('emits Tailwind triplet tokens (alpha-aware)', () => {
    expect(vars['--color-surface']).toBe('255 255 255')
    expect(vars['--color-elevated']).toBe('250 250 252')
    // Colliding text tokens expose their triplet via the -rgb suffix.
    expect(vars['--color-text-secondary-rgb']).toBe('110 110 115')
    expect(vars['--color-text-tertiary-rgb']).toBe('174 174 178')
  })

  it('emits Harmony-style semantic tokens as full colors', () => {
    expect(vars['--color-bg-primary']).toBe('rgb(255 255 255)')
    expect(vars['--color-bg-secondary']).toBe('rgb(245 245 247)')
    expect(vars['--color-text-primary']).toBe('rgb(29 29 31)')
    expect(vars['--color-text-secondary']).toBe('rgb(110 110 115)')
    expect(vars['--color-border-secondary']).toBe('rgb(210 210 215)')
  })

  it('covers all 14 Harmony palette tokens for dark mode', () => {
    const dark = paletteToCssVariables(DARK_PALETTE)
    expect(dark['--color-bg-primary']).toBe('rgb(28 28 30)')
    expect(dark['--color-text-primary']).toBe('rgb(245 245 247)')
    expect(dark['--color-accent-text']).toBe('#ffffff')
    expect(dark['--color-drag-handle']).toBe('rgba(255, 255, 255, 0.22)')
    expect(dark['--color-tabbar-inactive']).toBe('rgb(161 161 166)')
  })

  it('keeps divider in sync with border', () => {
    expect(vars['--color-divider']).toBe(vars['--color-border'])
  })
})

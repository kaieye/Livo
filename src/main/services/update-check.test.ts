import { describe, expect, it } from 'vitest'

import { __internal } from './update-check-internal'

describe('compareVersions', () => {
  it('compares numeric versions', () => {
    expect(__internal.compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0)
    expect(__internal.compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(__internal.compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
  })

  it('ignores v prefix', () => {
    expect(__internal.compareVersions('v1.2.0', '1.1.9')).toBeGreaterThan(0)
  })
})

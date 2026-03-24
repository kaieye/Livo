import { describe, expect, it } from 'vitest'
import {
  compareLocaleCompleteness,
  flattenLocaleKeys,
} from './i18n-completeness'

describe('i18n completeness helpers', () => {
  it('flattens nested locale keys', () => {
    expect(
      flattenLocaleKeys({
        common: {
          ok: 'OK',
          nested: {
            title: 'Title',
          },
        },
      }),
    ).toEqual(['common.nested.title', 'common.ok'])
  })

  it('reports missing and extra keys', () => {
    const report = compareLocaleCompleteness(
      {
        a: 'A',
        nested: {
          one: '1',
          two: '2',
        },
      },
      {
        a: 'A',
        nested: {
          one: '1',
        },
        extra: 'X',
      },
    )

    expect(report.missingKeys).toEqual(['nested.two'])
    expect(report.extraKeys).toEqual(['extra'])
    expect(report.completeness).toBe(67)
  })
})

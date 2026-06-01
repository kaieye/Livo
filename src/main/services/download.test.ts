import { describe, expect, it } from 'vitest'
import { sanitizeSuggestedFileName } from './download'

describe('sanitizeSuggestedFileName', () => {
  it('removes invalid filename characters', () => {
    expect(sanitizeSuggestedFileName('livo:recent/logs?.txt')).toBe(
      'livo-recent-logs-.txt',
    )
  })

  it('falls back when filename is empty', () => {
    expect(sanitizeSuggestedFileName('   ')).toBe('livo-export.txt')
  })

  it('keeps ordinary unicode filenames', () => {
    expect(sanitizeSuggestedFileName('封面图.png')).toBe('封面图.png')
  })
})

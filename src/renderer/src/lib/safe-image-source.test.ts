import { describe, expect, it } from 'vitest'
import { getSafeImageSrc } from './safe-image-source'

describe('safe-image-source', () => {
  it('keeps public image URLs', () => {
    expect(getSafeImageSrc(' https://cdn.example.com/image.jpg ')).toBe(
      'https://cdn.example.com/image.jpg',
    )
  })

  it.each([
    'http://127.0.0.1/image.jpg',
    'http://localhost/image.jpg',
    'http://10.0.0.5/image.jpg',
    'http://169.254.169.254/latest/meta-data',
    'https://user:pass@example.com/image.jpg',
    'file:///tmp/image.jpg',
    'data:image/png;base64,aaaa',
    '/relative/image.jpg',
  ])('blocks unsafe image source %s', (url) => {
    expect(getSafeImageSrc(url)).toBeUndefined()
  })
})

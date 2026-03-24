import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getRememberedImageMetadata,
  loadPersistedImageMetadata,
  rememberImageMetadata,
} from './image-metadata'

describe('image metadata cache', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        clear: () => {
          storage.clear()
        },
      },
      setTimeout,
      clearTimeout,
    })
    vi.restoreAllMocks()
  })

  it('remembers valid image dimensions', () => {
    const changed = rememberImageMetadata('https://example.com/a.jpg', {
      width: 800,
      height: 600,
    })

    expect(changed).toBe(true)
    expect(getRememberedImageMetadata('https://example.com/a.jpg')).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('hydrates persisted image metadata once loaded', () => {
    window.localStorage.setItem(
      'livo:image-metadata:v1',
      JSON.stringify({
        'https://example.com/cached.jpg': { width: 1200, height: 900 },
      }),
    )

    loadPersistedImageMetadata()

    expect(
      getRememberedImageMetadata('https://example.com/cached.jpg'),
    ).toEqual({
      width: 1200,
      height: 900,
    })
  })
})

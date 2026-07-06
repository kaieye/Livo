import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getRememberedImageMetadata,
  loadPersistedImageMetadata,
  probeImageMetadata,
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

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
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

  it('does not probe unsafe image metadata URLs', () => {
    const assigned: string[] = []

    class FakeImage {
      decoding = ''
      referrerPolicy = ''
      naturalWidth = 800
      naturalHeight = 600
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(value: string) {
        assigned.push(value)
        this.onload?.()
      }
    }

    vi.stubGlobal('window', {
      ...window,
      Image: FakeImage,
    })
    const onResolved = vi.fn()

    probeImageMetadata(
      [
        'http://127.0.0.1/private.jpg',
        'https://user:pass@example.com/secret.jpg',
        'https://cdn.example.com/public.jpg',
      ],
      onResolved,
    )

    expect(assigned).toEqual(['https://cdn.example.com/public.jpg'])
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it('removes secret URL components before persisting image metadata', async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
      },
      setTimeout,
      clearTimeout,
    })
    const { rememberImageMetadata } = await import('./image-metadata')

    rememberImageMetadata(
      'https://user:pass@example.com/a.jpg?token=raw-token&ig_cache_key=abc',
      {
        width: 800,
        height: 600,
      },
    )
    await vi.runAllTimersAsync()

    const persisted = storage.get('livo:image-metadata:v1') || ''
    expect(persisted).not.toContain('raw-token')
    expect(persisted).not.toContain('user:pass')
    expect(persisted).toContain('https://example.com/a.jpg?ig_cache_key=abc')
  })

  it('sanitizes legacy image metadata cache keys during hydration', async () => {
    vi.resetModules()
    const storage = new Map<string, string>([
      [
        'livo:image-metadata:v1',
        JSON.stringify({
          'https://user:pass@example.com/a.jpg?token=raw-token&ig_cache_key=abc':
            { width: 800, height: 600 },
        }),
      ],
    ])
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
      },
      setTimeout,
      clearTimeout,
    })
    const { getRememberedImageMetadata, loadPersistedImageMetadata } =
      await import('./image-metadata')

    loadPersistedImageMetadata()

    expect(
      getRememberedImageMetadata(
        'https://user:pass@example.com/a.jpg?token=raw-token&ig_cache_key=abc',
      ),
    ).toEqual({ width: 800, height: 600 })
    const persisted = storage.get('livo:image-metadata:v1') || ''
    expect(persisted).not.toContain('raw-token')
    expect(persisted).not.toContain('user:pass')
  })
})

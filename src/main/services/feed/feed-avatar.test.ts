import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveFeedAvatar } from './feed-avatar'

describe('resolveFeedAvatar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a site-level profile image when a FeedBurner feed has no image metadata', async () => {
    const imageBytes = new Uint8Array(80).fill(1)
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/blog/images/person2_s.jpg')) {
        return new Response(imageBytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
      }

      return new Response(
        `
          <html>
            <body>
              <div class="module-categories module">
                <h2>关于</h2>
                <img src="/blog/images/person2_s.jpg" alt="个人照片" />
              </div>
              <article>
                <img src="https://cdn.example.com/latest-post-cover.webp" />
              </article>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveFeedAvatar(
        'https://feeds.feedburner.com/ruanyifeng',
        undefined,
        undefined,
        'https://93.184.216.34/blog/',
      ),
    ).resolves.toBe(
      `data:image/jpeg;base64,${Buffer.from(imageBytes).toString('base64')}`,
    )
  })

  it('does not fetch a loopback site avatar page', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveFeedAvatar(
        'https://feeds.example.com/rss',
        undefined,
        'https://cdn.example.com/existing.jpg',
        'http://127.0.0.1/admin',
      ),
    ).resolves.toBe('https://cdn.example.com/existing.jpg')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not follow a site avatar redirect to loopback', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('', {
        status: 302,
        headers: { location: 'http://127.0.0.1/admin' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveFeedAvatar(
        'https://feeds.example.com/rss',
        undefined,
        'https://cdn.example.com/existing.jpg',
        'https://93.184.216.34/blog/',
      ),
    ).resolves.toBe('https://cdn.example.com/existing.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not inline an oversized site avatar image', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/avatar.jpg')) {
        return new Response(new Uint8Array(80), {
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
            'content-length': String(3 * 1024 * 1024),
          },
        })
      }

      return new Response(
        '<html><head><meta property="og:image" content="/avatar.jpg"></head></html>',
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      resolveFeedAvatar(
        'https://feeds.example.com/rss',
        undefined,
        undefined,
        'https://93.184.216.34/blog/',
      ),
    ).resolves.toBe('https://93.184.216.34/avatar.jpg')
  })
})

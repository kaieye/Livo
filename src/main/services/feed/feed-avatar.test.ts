import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveFeedAvatar } from './feed-avatar'

describe('resolveFeedAvatar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a site-level profile image when a FeedBurner feed has no image metadata', async () => {
    const fetchMock = vi.fn(async () => {
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
        'https://www.ruanyifeng.com/blog/',
      ),
    ).resolves.toBe('https://www.ruanyifeng.com/blog/images/person2_s.jpg')
  })
})

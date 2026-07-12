import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      fetch: fetchMock,
      cookies: {
        get: vi.fn(async () => []),
      },
    },
  },
}))

vi.mock('../system/network-url-policy', () => ({
  assertNetworkFetchUrl: vi.fn(async (url: string) => url),
}))

import { fetchAndParseFeed } from './rss-parser'
import { CURATED_FEEDS } from '../../../shared/discover-data'

function rss(items: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Instagram Feed</title>
    <link>https://www.instagram.com/roses_are_rosie/</link>
    ${items}
  </channel>
</rss>`
}

function item(title: string, content: string): string {
  return `<item>
  <title>${title}</title>
  <link>https://picnob.com/post/${encodeURIComponent(title)}</link>
  <guid>${title}</guid>
  <pubDate>Sun, 12 Jul 2026 00:00:00 GMT</pubDate>
  <description><![CDATA[${content}]]></description>
</item>`
}

describe('rss-parser RSSHub mirror routes', () => {
  afterEach(() => {
    fetchMock.mockReset()
  })

  it('fans out built-in Instagram picture feeds across official and mirror route candidates', async () => {
    const builtinPicnob = CURATED_FEEDS.find((feed) =>
      /^rsshub:\/\/picnob\/user\//i.test(feed.url),
    )
    const builtinInstagram = CURATED_FEEDS.find((feed) =>
      /^rsshub:\/\/instagram\/user\//i.test(feed.url),
    )
    expect(
      builtinPicnob,
      'expected a built-in picnob picture feed',
    ).toBeTruthy()
    expect(
      builtinInstagram,
      'expected a built-in instagram picture feed',
    ).toBeTruthy()

    const picnobUser = builtinPicnob!.url.match(
      /^rsshub:\/\/picnob\/user\/([^/?#]+)/i,
    )![1]
    const instagramUser = builtinInstagram!.url.match(
      /^rsshub:\/\/instagram\/user\/([^/?#]+)/i,
    )![1]

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes(`/pixnoy/user/${picnobUser}`)) {
        return new Response(
          rss(item('rich-post', '<p>caption from pixnoy fallback</p>')),
          { status: 200 },
        )
      }
      if (url.includes(`/picnob/user/${instagramUser}`)) {
        return new Response(
          rss(
            item('instagram-rich-post', '<p>caption from picnob fallback</p>'),
          ),
          { status: 200 },
        )
      }

      return new Response(rss(''), { status: 200 })
    })

    const picnobResult = await fetchAndParseFeed(
      `https://rsshub.example.com/picnob/user/${picnobUser}`,
    )
    const instagramResult = await fetchAndParseFeed(
      `https://rsshub.example.com/instagram/user/${instagramUser}`,
    )
    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]))

    expect(requestedUrls).toContain(
      `https://rsshub.example.com/instagram/user/${picnobUser}`,
    )
    expect(requestedUrls).toContain(
      `https://rsshub.example.com/picnob/user/${picnobUser}`,
    )
    expect(requestedUrls).toContain(
      `https://rsshub.example.com/pixnoy/user/${picnobUser}`,
    )
    expect(requestedUrls).toContain(
      `https://rsshub.example.com/instagram/user/${instagramUser}`,
    )
    expect(requestedUrls).toContain(
      `https://rsshub.example.com/picnob/user/${instagramUser}`,
    )
    expect(picnobResult.data?.items?.[0]?.title).toBe('rich-post')
    expect(picnobResult.data?.items?.[0]?.content).toContain(
      'caption from pixnoy fallback',
    )
    expect(instagramResult.data?.items?.[0]?.title).toBe('instagram-rich-post')
  })
})

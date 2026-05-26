import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAbsoluteUrl,
  discoverFeedUrlFromHtml,
  parseFeedTitle,
  parseFeedDescription,
  parseFeedSiteUrl,
  parseFeedImageUrl,
  parseRssItems,
  parseAtomItems,
  buildEntriesFromItems,
  ParsedItem,
} from '../entry/src/main/ets/common/services/rss-feed/RssFeedParserPure.ts'

// ---------------------------------------------------------------------------
// resolveAbsoluteUrl
// ---------------------------------------------------------------------------

test('resolveAbsoluteUrl: already-absolute URLs pass through', () => {
  const result = resolveAbsoluteUrl(
    'https://example.com/feed.xml',
    'https://other.com/post',
  )
  assert.equal(result, 'https://other.com/post')
})

test('resolveAbsoluteUrl: protocol-relative URLs get base protocol', () => {
  const result = resolveAbsoluteUrl(
    'https://example.com/feed.xml',
    '//cdn.example.com/img.png',
  )
  assert.equal(result, 'https://cdn.example.com/img.png')
})

test('resolveAbsoluteUrl: path-relative URLs resolve against base path', () => {
  const result = resolveAbsoluteUrl(
    'https://example.com/blog/feed.xml',
    'post-123',
  )
  assert.equal(result, 'https://example.com/blog/post-123')
})

test('resolveAbsoluteUrl: root-relative URLs resolve to domain root', () => {
  const result = resolveAbsoluteUrl(
    'https://example.com/deep/nested/feed.xml',
    '/images/logo.png',
  )
  assert.equal(result, 'https://example.com/images/logo.png')
})

test('resolveAbsoluteUrl: empty input returns empty string', () => {
  const result = resolveAbsoluteUrl('https://example.com/feed.xml', '')
  assert.equal(result, '')
})

test('resolveAbsoluteUrl: http base works for protocol-relative URLs', () => {
  const result = resolveAbsoluteUrl(
    'http://example.com/feed.xml',
    '//cdn.example.com/img.png',
  )
  assert.equal(result, 'http://cdn.example.com/img.png')
})

// ---------------------------------------------------------------------------
// discoverFeedUrlFromHtml
// ---------------------------------------------------------------------------

test('discoverFeedUrlFromHtml: finds RSS alternate link', () => {
  const html =
    '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>'
  const result = discoverFeedUrlFromHtml(html, 'https://example.com')
  assert.equal(result, 'https://example.com/feed.xml')
})

test('discoverFeedUrlFromHtml: finds Atom alternate link', () => {
  const html =
    '<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>'
  const result = discoverFeedUrlFromHtml(html, 'https://example.com')
  assert.equal(result, 'https://example.com/atom.xml')
})

test('discoverFeedUrlFromHtml: ignores non-alternate links', () => {
  const html =
    '<html><head><link rel="stylesheet" type="text/css" href="/style.css"></head></html>'
  const result = discoverFeedUrlFromHtml(html, 'https://example.com')
  assert.equal(result, '')
})

test('discoverFeedUrlFromHtml: returns empty for no matches', () => {
  const result = discoverFeedUrlFromHtml('<html></html>', 'https://example.com')
  assert.equal(result, '')
})

// ---------------------------------------------------------------------------
// parseFeedTitle
// ---------------------------------------------------------------------------

test('parseFeedTitle: extracts RSS channel title', () => {
  const xml =
    '<?xml version="1.0"?><rss><channel><title>My Blog</title></channel></rss>'
  assert.equal(parseFeedTitle(xml), 'My Blog')
})

test('parseFeedTitle: extracts Atom title', () => {
  const xml =
    '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Blog</title></feed>'
  assert.equal(parseFeedTitle(xml), 'Atom Blog')
})

test('parseFeedTitle: strips HTML from title', () => {
  const xml =
    '<rss><channel><title><![CDATA[My <b>Blog</b>]]></title></channel></rss>'
  assert.equal(parseFeedTitle(xml), 'My Blog')
})

test('parseFeedTitle: returns empty for empty XML', () => {
  assert.equal(parseFeedTitle(''), '')
})

// ---------------------------------------------------------------------------
// parseFeedDescription
// ---------------------------------------------------------------------------

test('parseFeedDescription: extracts RSS channel description', () => {
  const xml =
    '<rss><channel><description>A great feed</description></channel></rss>'
  assert.equal(parseFeedDescription(xml), 'A great feed')
})

test('parseFeedDescription: extracts Atom subtitle', () => {
  const xml =
    '<feed xmlns="http://www.w3.org/2005/Atom"><subtitle>Atom subtitle</subtitle></feed>'
  assert.equal(parseFeedDescription(xml), 'Atom subtitle')
})

test('parseFeedDescription: strips HTML from description', () => {
  const xml =
    '<rss><channel><description><![CDATA[<p>A <em>great</em> feed</p>]]></description></channel></rss>'
  assert.equal(parseFeedDescription(xml), 'A great feed')
})

// ---------------------------------------------------------------------------
// parseFeedSiteUrl
// ---------------------------------------------------------------------------

test('parseFeedSiteUrl: extracts RSS channel link relative to feed URL', () => {
  const xml = '<rss><channel><link>https://example.com</link></channel></rss>'
  assert.equal(
    parseFeedSiteUrl(xml, 'https://example.com/feed.xml'),
    'https://example.com',
  )
})

test('parseFeedSiteUrl: extracts Atom alternate link', () => {
  const xml =
    '<feed xmlns="http://www.w3.org/2005/Atom"><link rel="alternate" href="https://example.com"/></feed>'
  assert.equal(
    parseFeedSiteUrl(xml, 'https://example.com/atom.xml'),
    'https://example.com',
  )
})

test('parseFeedSiteUrl: resolves relative site URLs', () => {
  const xml = '<rss><channel><link>/blog</link></channel></rss>'
  assert.equal(
    parseFeedSiteUrl(xml, 'https://example.com/feed.xml'),
    'https://example.com/blog',
  )
})

// ---------------------------------------------------------------------------
// parseFeedImageUrl
// ---------------------------------------------------------------------------

test('parseFeedImageUrl: extracts RSS image url', () => {
  const xml =
    '<rss><channel><image><url>https://example.com/logo.png</url></image></channel></rss>'
  assert.equal(
    parseFeedImageUrl(xml, 'https://example.com'),
    'https://example.com/logo.png',
  )
})

test('parseFeedImageUrl: extracts iTunes image href', () => {
  const xml =
    '<rss><channel><itunes:image href="https://example.com/cover.jpg"/></channel></rss>'
  assert.equal(
    parseFeedImageUrl(xml, 'https://example.com'),
    'https://example.com/cover.jpg',
  )
})

test('parseFeedImageUrl: extracts Atom logo', () => {
  const xml =
    '<feed xmlns="http://www.w3.org/2005/Atom"><logo>https://example.com/logo.png</logo></feed>'
  assert.equal(
    parseFeedImageUrl(xml, 'https://example.com'),
    'https://example.com/logo.png',
  )
})

test('parseFeedImageUrl: returns empty for missing image', () => {
  assert.equal(
    parseFeedImageUrl('<rss><channel></channel></rss>', 'https://example.com'),
    '',
  )
})

// ---------------------------------------------------------------------------
// parseRssItems
// ---------------------------------------------------------------------------

const rssSample = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>First Post</title>
      <link>https://example.com/post-1</link>
      <guid isPermaLink="true">https://example.com/post-1</guid>
      <description>Summary of post 1</description>
      <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/">Full content of post 1</content:encoded>
      <author>Alice</author>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/post-2</link>
      <description>Summary of post 2</description>
      <author>Bob</author>
      <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

test('parseRssItems: parses correct number of items', () => {
  const items = parseRssItems('feed-1', rssSample, 'https://example.com')
  assert.equal(items.length, 2)
})

test('parseRssItems: extracts title, link, author', () => {
  const items = parseRssItems('feed-1', rssSample, 'https://example.com')
  assert.equal(items[0].title, 'First Post')
  assert.equal(items[0].link, 'https://example.com/post-1')
  assert.equal(items[0].author, 'Alice')
})

test('parseRssItems: uses content:encoded over description', () => {
  const items = parseRssItems('feed-1', rssSample, 'https://example.com')
  assert.ok(items[0].content.includes('Full content of post 1'))
})

test('parseRssItems: falls back to description for content', () => {
  const items = parseRssItems('feed-1', rssSample, 'https://example.com')
  assert.ok(items[1].content.includes('Summary of post 2'))
})

test('parseRssItems: generates predictable entry IDs', () => {
  const items = parseRssItems('feed-1', rssSample, 'https://example.com')
  // ID is based on feedId + guid + link + title
  assert.ok(items[0].id.startsWith('feed-1-'))
  assert.notEqual(items[0].id, items[1].id)
})

test('parseRssItems: parses tags from category elements', () => {
  const xml = `<rss><channel><item>
    <title>T</title><link>https://a.com</link>
    <category>tech</category><category>news</category>
  </item></channel></rss>`
  const items = parseRssItems('feed-1', xml, 'https://a.com')
  assert.deepEqual(items[0].tags, ['tech', 'news'])
})

// ---------------------------------------------------------------------------
// parseAtomItems
// ---------------------------------------------------------------------------

const atomSample = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Entry One</title>
    <link rel="alternate" href="https://example.com/entry-1"/>
    <id>urn:uuid:1234</id>
    <content type="html">Full content of entry 1</content>
    <author><name>Charlie</name></author>
    <published>2024-01-01T12:00:00Z</published>
    <category term="tech"/>
    <category term="news"/>
  </entry>
  <entry>
    <title>Entry Two</title>
    <link href="https://example.com/entry-2"/>
    <summary>Summary of entry 2</summary>
    <author><name>Dana</name></author>
    <updated>2024-01-02T12:00:00Z</updated>
  </entry>
</feed>`

test('parseAtomItems: parses correct number of entries', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.equal(items.length, 2)
})

test('parseAtomItems: extracts title and author', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.equal(items[0].title, 'Entry One')
  assert.equal(items[0].author, 'Charlie')
})

test('parseAtomItems: resolves alternate link', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.equal(items[0].link, 'https://example.com/entry-1')
})

test('parseAtomItems: falls back to href-only link', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.equal(items[1].link, 'https://example.com/entry-2')
})

test('parseAtomItems: extracts category tags', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.deepEqual(items[0].tags, ['tech', 'news'])
})

test('parseAtomItems: uses summary for content when no content element', () => {
  const items = parseAtomItems('feed-1', atomSample, 'https://example.com')
  assert.ok(items[1].content.includes('Summary of entry 2'))
})

// ---------------------------------------------------------------------------
// buildEntriesFromItems
// ---------------------------------------------------------------------------

function makeFeed(id: string) {
  return {
    id,
    title: 'F',
    url: 'https://f.com/rss',
    siteUrl: 'https://f.com',
    view: 0,
    showInAll: true,
    errorCount: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeItem(id: string, link: string, title: string): ParsedItem {
  return {
    id,
    title,
    link,
    summary: '',
    content: '',
    author: 'A',
    publishedAt: 0,
    tags: [],
    mediaUrls: [],
  }
}

test('buildEntriesFromItems: converts items to entries', () => {
  const feed = makeFeed('feed-1')
  const items = [
    makeItem('i1', 'https://a.com/1', 'Post 1'),
    makeItem('i2', 'https://a.com/2', 'Post 2'),
  ]
  const entries = buildEntriesFromItems(items, feed)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].feedId, 'feed-1')
  assert.equal(entries[0].url, 'https://a.com/1')
  assert.equal(entries[0].isRead, false)
  assert.equal(entries[0].isStarred, false)
})

test('buildEntriesFromItems: deduplicates by X/Twitter status ID', () => {
  const feed = makeFeed('feed-1')
  const items = [
    makeItem('i1', 'https://x.com/user/status/1234567890', 'Post 1'),
    makeItem(
      'i2',
      'https://twitter.com/user/status/1234567890',
      'Post 1 (dup)',
    ),
  ]
  const entries = buildEntriesFromItems(items, feed)
  assert.equal(entries.length, 1)
})

test('buildEntriesFromItems: does not deduplicate when no status ID', () => {
  const feed = makeFeed('feed-1')
  const items = [
    makeItem('i1', 'https://example.com/a', 'A'),
    makeItem('i2', 'https://example.com/b', 'B'),
  ]
  const entries = buildEntriesFromItems(items, feed)
  assert.equal(entries.length, 2)
})

test('buildEntriesFromItems: fallback URL when link is empty', () => {
  const feed = makeFeed('feed-1')
  const items = [makeItem('i1', '', 'Post')]
  const entries = buildEntriesFromItems(items, feed)
  assert.equal(entries[0].url, 'https://f.com')
})

test('buildEntriesFromItems: assigns reading time', () => {
  const feed = makeFeed('feed-1')
  const item: ParsedItem = {
    id: 'i1',
    title: 'Long Post',
    link: 'https://a.com',
    summary: '',
    content: 'x'.repeat(500),
    author: 'A',
    publishedAt: 0,
    tags: [],
    mediaUrls: [],
  }
  const entries = buildEntriesFromItems([item], feed)
  assert.ok(entries[0].readingTimeMinutes >= 1)
})

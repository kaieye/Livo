import { describe, expect, it } from 'vitest'
import { generateOPML, OPMLParseLimitError, parseOPML } from './opml-parser'

function opmlBody(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
${body}
  </body>
</opml>`
}

describe('parseOPML', () => {
  it('parses nested feed outlines with categories', () => {
    const feeds = parseOPML(
      opmlBody(`
    <outline text="Tech">
      <outline text="Example" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com" />
    </outline>`),
    )

    expect(feeds).toEqual([
      {
        title: 'Example',
        xmlUrl: 'https://example.com/feed.xml',
        htmlUrl: 'https://example.com',
        category: 'Tech',
      },
    ])
  })

  it('rejects OPML that exceeds parser resource limits', () => {
    expect(() =>
      parseOPML(
        opmlBody(`
    <outline text="One" xmlUrl="https://example.com/one.xml" />
    <outline text="Two" xmlUrl="https://example.com/two.xml" />`),
        { maxFeeds: 1 },
      ),
    ).toThrow(OPMLParseLimitError)

    expect(() =>
      parseOPML(
        opmlBody(`
    <outline text="Folder">
      <outline text="Nested">
        <outline text="Too deep" xmlUrl="https://example.com/feed.xml" />
      </outline>
    </outline>`),
        { maxCategoryDepth: 1 },
      ),
    ).toThrow(OPMLParseLimitError)

    expect(() =>
      parseOPML(
        opmlBody(`
    <outline text="One" xmlUrl="https://example.com/one.xml" />
    <outline text="Two" xmlUrl="https://example.com/two.xml" />`),
        { maxOutlineTags: 1 },
      ),
    ).toThrow(OPMLParseLimitError)

    expect(() =>
      parseOPML(
        opmlBody(`
    <outline text="${'x'.repeat(20)}" xmlUrl="https://example.com/feed.xml" />`),
        { maxAttributeTextLength: 10 },
      ),
    ).toThrow(OPMLParseLimitError)
  })
})

describe('generateOPML', () => {
  it('removes secret URL components from exported feed URLs', () => {
    const opml = generateOPML([
      {
        title: 'Private feed',
        url: 'https://user:pass@example.com/rss.xml?token=raw-token&ok=1',
        siteUrl:
          'https://example.com/site?X-Amz-Signature=raw-signature&view=1',
        category: 'Private',
      },
    ])

    expect(opml).not.toContain('raw-token')
    expect(opml).not.toContain('raw-signature')
    expect(opml).not.toContain('user:pass')
    expect(opml).toContain('xmlUrl="https://example.com/rss.xml?ok=1"')
    expect(opml).toContain('htmlUrl="https://example.com/site?view=1"')
  })
})

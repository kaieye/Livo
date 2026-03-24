import { describe, expect, it } from 'vitest'
import { extractReadableContent, resolveRelativeUrls } from './readability'

describe('readability service', () => {
  it('extracts sanitized article content and metadata', () => {
    const html = `
      <html>
        <head>
          <title>Ignored Title</title>
          <meta property="og:title" content="Readable Title" />
          <meta property="og:site_name" content="Example Site" />
        </head>
        <body>
          <article>
            <h1>Readable Title</h1>
            <p>First paragraph with enough text to be kept by the readability parser.</p>
            <p>Second paragraph with a <a href="/story">relative link</a>.</p>
            <script>alert("xss")</script>
          </article>
        </body>
      </html>
    `

    const result = extractReadableContent(html, 'https://example.com/post')

    expect(result.title).toBe('Readable Title')
    expect(result.siteName).toBe('Example Site')
    expect(result.content).toContain('https://example.com/story')
    expect(result.content).not.toContain('<script')
    expect(result.length).toBeGreaterThan(20)
  })

  it('resolves relative URLs in extracted html', () => {
    const html = '<p><img src="/image.jpg" /><a href="child">child</a></p>'
    const resolved = resolveRelativeUrls(html, 'https://example.com/post')

    expect(resolved).toContain('src="https://example.com/image.jpg"')
    expect(resolved).toContain('href="https://example.com/child"')
  })
})

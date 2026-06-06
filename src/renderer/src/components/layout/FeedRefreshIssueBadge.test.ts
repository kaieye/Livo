import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FeedRefreshIssueBadge } from './FeedRefreshIssueBadge'

describe('FeedRefreshIssueBadge', () => {
  it('renders an aria-hidden warning icon when issue label exists', () => {
    const html = renderToStaticMarkup(
      createElement(FeedRefreshIssueBadge, {
        label: 'Last refresh failed: HTTP 403',
      }),
    )

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('svg')
  })

  it('renders nothing without an issue label', () => {
    const html = renderToStaticMarkup(
      createElement(FeedRefreshIssueBadge, { label: null }),
    )

    expect(html).toBe('')
  })
})

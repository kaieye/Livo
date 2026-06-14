import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import { planEntryWrite } from './entry-write-plan'

function entry(input: Partial<Entry>): Entry {
  return {
    id: input.id || 'entry',
    feedId: input.feedId || 'feed-1',
    title: input.title || '',
    url: input.url ?? `https://example.com/${input.id || 'entry'}`,
    content: input.content || '',
    summary: input.summary || '',
    author: input.author,
    imageUrl: input.imageUrl,
    publishedAt: input.publishedAt ?? 1,
    isRead: input.isRead ?? false,
    isStarred: input.isStarred ?? false,
    isListened: input.isListened ?? false,
    media: input.media || [],
    createdAt: input.createdAt ?? 1,
  }
}

describe('planEntryWrite', () => {
  it('plans an insert when there is no match', () => {
    const incoming = entry({
      id: 'fresh',
      title: 'Hello',
      url: 'https://example.com/fresh',
    })
    const plan = planEntryWrite(incoming, [])
    expect(plan.type).toBe('insert')
  })

  it('plans a merge into the row that shares the same URL', () => {
    const existing = entry({
      id: 'orig',
      title: 'Short',
      url: 'https://example.com/same',
      content: 'short',
      publishedAt: 1000,
    })
    const incoming = entry({
      id: 'dupe',
      title: 'A much longer title',
      url: 'https://example.com/same',
      content: 'a much longer body of content',
      publishedAt: 2000,
    })

    const plan = planEntryWrite(incoming, [existing])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    expect(plan.targetId).toBe('orig')

    // applyMerge mutates the full existing row in place and reports change.
    const full = { ...existing }
    const changed = plan.applyMerge(full)
    expect(changed).toBe(true)
    expect(full.title).toBe('A much longer title')
    expect(full.content).toBe('a much longer body of content')
    expect(full.publishedAt).toBe(2000)
  })

  it('plans a merge by identity key when raw URLs differ', () => {
    const existing = entry({
      id: 'orig',
      title: 'Same story',
      url: 'https://example.com/story?utm_source=newsletter',
      content: 'first',
      publishedAt: 1000,
    })
    const incoming = entry({
      id: 'other',
      title: 'Same story',
      url: 'https://example.com/story?utm_source=twitter',
      content: 'a longer richer body',
      publishedAt: 1000,
    })

    const plan = planEntryWrite(incoming, [existing])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    expect(plan.targetId).toBe('orig')

    const full = { ...existing }
    expect(plan.applyMerge(full)).toBe(true)
    expect(full.content).toBe('a longer richer body')
  })

  it('prefers the exact URL match over a later identity-key match', () => {
    const urlTwin = entry({
      id: 'url-twin',
      title: 'Same story',
      url: 'https://example.com/story?utm_source=a',
      publishedAt: 1000,
    })
    const exact = entry({
      id: 'exact',
      title: 'Same story',
      url: 'https://example.com/story?utm_source=keep',
      publishedAt: 1000,
    })
    const incoming = entry({
      id: 'incoming',
      title: 'Same story',
      url: 'https://example.com/story?utm_source=keep',
      publishedAt: 1000,
    })

    const plan = planEntryWrite(incoming, [urlTwin, exact])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    expect(plan.targetId).toBe('exact')
  })

  it('plans a merge for a broken-scraper entry within the title/time window', () => {
    const base = 10 * 24 * 60 * 60 * 1000
    const good = entry({
      id: 'good',
      title: 'Sunset photos',
      url: 'https://picnob.com/post/ABCDEF',
      summary: 'short',
      publishedAt: base,
    })
    const broken = entry({
      id: 'broken',
      title: 'Sunset photos',
      url: 'https://instagram.com/p/1234567890123/',
      summary: 'a longer summary text that should win',
      publishedAt: base + 60 * 60 * 1000,
    })

    const plan = planEntryWrite(broken, [good])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    expect(plan.targetId).toBe('good')

    const full = { ...good }
    expect(plan.applyMerge(full)).toBe(true)
    expect(full.summary).toBe('a longer summary text that should win')
  })

  it('picks the closest-in-time candidate for a broken-scraper entry', () => {
    const base = 10 * 24 * 60 * 60 * 1000
    const near = entry({
      id: 'near',
      title: 'Sunset photos',
      url: 'https://picnob.com/post/NEAR',
      publishedAt: base + 60 * 60 * 1000,
    })
    const far = entry({
      id: 'far',
      title: 'Sunset photos',
      url: 'https://picnob.com/post/FAR',
      publishedAt: base + 40 * 60 * 60 * 1000,
    })
    const broken = entry({
      id: 'broken',
      title: 'Sunset photos',
      url: 'https://instagram.com/p/1234567890123/',
      publishedAt: base,
    })

    const plan = planEntryWrite(broken, [far, near])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    expect(plan.targetId).toBe('near')
  })

  it('plans a noop for a broken-scraper entry with no window match', () => {
    const broken = entry({
      id: 'broken',
      title: 'No match here',
      url: 'https://instagram.com/p/9876543210987/',
      publishedAt: 5000,
    })
    expect(planEntryWrite(broken, []).type).toBe('noop')
  })

  it('does not match a broken-scraper entry outside the 48h window', () => {
    const good = entry({
      id: 'good',
      title: 'Sunset photos',
      url: 'https://picnob.com/post/ABCDEF',
      publishedAt: 0,
    })
    const broken = entry({
      id: 'broken',
      title: 'Sunset photos',
      url: 'https://instagram.com/p/1234567890123/',
      publishedAt: 49 * 60 * 60 * 1000,
    })
    expect(planEntryWrite(broken, [good]).type).toBe('noop')
  })

  it('plans an insert (no-op merge avoided) when a URL match has nothing richer', () => {
    // The plan still targets a merge, but applyMerge reports no change so the
    // executor performs no write. This mirrors the repository "no-op" path.
    const existing = entry({
      id: 'orig',
      title: 'Stable title',
      url: 'https://example.com/stable',
      content: 'full content already',
      summary: 'full summary already',
      publishedAt: 2000,
    })
    const incoming = entry({
      id: 'weaker',
      title: 'Short',
      url: 'https://example.com/stable',
      content: 'tiny',
      summary: 'tiny',
      publishedAt: 1000,
    })

    const plan = planEntryWrite(incoming, [existing])
    expect(plan.type).toBe('merge')
    if (plan.type !== 'merge') return
    const full = { ...existing }
    expect(plan.applyMerge(full)).toBe(false)
  })
})

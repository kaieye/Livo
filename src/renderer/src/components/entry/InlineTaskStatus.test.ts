import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { InlineTaskStatus } from './InlineTaskStatus'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}))

const noop = vi.fn()

describe('InlineTaskStatus', () => {
  it('renders running and failed task rows with actions', () => {
    const html = renderToStaticMarkup(
      createElement(InlineTaskStatus, {
        fulltext: { status: 'running' },
        aiSummary: { status: 'failed', error: 'API key missing' },
        onRetryFulltext: noop,
        onRetrySummary: noop,
        onOpenAISettings: noop,
      }),
    )

    expect(html).toContain('正在抓取全文...')
    expect(html).toContain('AI 摘要生成失败：API key missing')
    expect(html).toContain('打开设置')
    expect(html).toContain('重试')
  })

  it('renders nothing for idle and succeeded states', () => {
    const html = renderToStaticMarkup(
      createElement(InlineTaskStatus, {
        fulltext: { status: 'idle' },
        aiSummary: { status: 'succeeded' },
        onRetryFulltext: noop,
        onRetrySummary: noop,
        onOpenAISettings: noop,
      }),
    )

    expect(html).toBe('')
  })
})

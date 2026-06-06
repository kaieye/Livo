import { describe, expect, it } from 'vitest'
import { buildEntryInlineTaskStatusItems } from './entry-inline-task-status'

const labels = {
  fulltextRunning: '正在抓取全文...',
  fulltextFailed: '全文抓取失败',
  aiSummaryRunning: '正在生成摘要...',
  aiSummaryFailed: 'AI 摘要生成失败',
  unknownError: '未知错误',
}

describe('buildEntryInlineTaskStatusItems', () => {
  it('builds running task messages for queued and running states', () => {
    expect(
      buildEntryInlineTaskStatusItems({
        fulltext: { status: 'queued' },
        aiSummary: { status: 'running' },
        labels,
      }),
    ).toEqual([
      {
        key: 'fulltext',
        isRunning: true,
        message: '正在抓取全文...',
        canOpenSettings: false,
      },
      {
        key: 'aiSummary',
        isRunning: true,
        message: '正在生成摘要...',
        canOpenSettings: false,
      },
    ])
  })

  it('builds failed task messages and exposes AI settings action for config errors', () => {
    expect(
      buildEntryInlineTaskStatusItems({
        fulltext: { status: 'failed', error: 'HTTP 403' },
        aiSummary: { status: 'failed', error: 'API key missing' },
        labels,
      }),
    ).toEqual([
      {
        key: 'fulltext',
        isRunning: false,
        message: '全文抓取失败：HTTP 403',
        canOpenSettings: false,
      },
      {
        key: 'aiSummary',
        isRunning: false,
        message: 'AI 摘要生成失败：API key missing',
        canOpenSettings: true,
      },
    ])
  })

  it('hides idle and succeeded task states', () => {
    expect(
      buildEntryInlineTaskStatusItems({
        fulltext: { status: 'idle' },
        aiSummary: { status: 'succeeded' },
        labels,
      }),
    ).toEqual([])
  })
})

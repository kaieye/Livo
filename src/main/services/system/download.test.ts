import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadUrlToFile,
  sanitizeSuggestedFileName,
  saveTextFile,
} from './download'

const mocks = vi.hoisted(() => ({
  downloadsPath: '',
  fetch: vi.fn(),
  showSaveDialog: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.downloadsPath),
    getVersion: vi.fn(() => '0.1.0-test'),
  },
  dialog: {
    showSaveDialog: mocks.showSaveDialog,
  },
  session: {
    defaultSession: {
      fetch: mocks.fetch,
    },
  },
}))

function responseWithBody(body: BodyInit, init?: ResponseInit): Response {
  return new Response(body, init)
}

describe('sanitizeSuggestedFileName', () => {
  it('removes invalid filename characters', () => {
    expect(sanitizeSuggestedFileName('livo:recent/logs?.txt')).toBe(
      'livo-recent-logs-.txt',
    )
  })

  it('falls back when filename is empty', () => {
    expect(sanitizeSuggestedFileName('   ')).toBe('livo-export.txt')
  })

  it('keeps ordinary unicode filenames', () => {
    expect(sanitizeSuggestedFileName('封面图.png')).toBe('封面图.png')
  })

  it('truncates very long filenames', () => {
    expect(sanitizeSuggestedFileName(`${'a'.repeat(240)}.txt`)).toHaveLength(
      180,
    )
  })
})

describe('saveTextFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.downloadsPath = mkdtempSync(join(tmpdir(), 'livo-download-test-'))
  })

  afterEach(() => {
    rmSync(mocks.downloadsPath, { recursive: true, force: true })
  })

  it('rejects oversized text before showing a save dialog', async () => {
    const result = await saveTextFile({
      content: 'x'.repeat(10 * 1024 * 1024 + 1),
      defaultFileName: 'too-large.txt',
    })

    expect(result).toEqual({ success: false, error: 'content_too_large' })
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })
})

describe('downloadUrlToFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.downloadsPath = mkdtempSync(join(tmpdir(), 'livo-download-test-'))
  })

  afterEach(() => {
    rmSync(mocks.downloadsPath, { recursive: true, force: true })
  })

  it('rejects downloads with an oversized content-length before showing a save dialog', async () => {
    mocks.fetch.mockResolvedValue(
      responseWithBody('', {
        headers: {
          'content-length': String(100 * 1024 * 1024 + 1),
        },
      }),
    )

    const result = await downloadUrlToFile({
      url: 'https://example.com/large.bin',
    })

    expect(result).toEqual({ success: false, error: 'download_too_large' })
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })

  it('stops streaming downloads that exceed the byte limit and removes partial files', async () => {
    const filePath = join(mocks.downloadsPath, 'large.bin')
    const chunk = new Uint8Array(1024 * 1024)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 101; index += 1) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
    mocks.fetch.mockResolvedValue(responseWithBody(stream))
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await downloadUrlToFile({
      url: 'https://example.com/large.bin',
    })

    expect(result).toEqual({ success: false, error: 'download_too_large' })
    expect(existsSync(filePath)).toBe(false)
  })
})

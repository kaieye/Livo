import { existsSync, mkdtempSync, rmSync } from 'fs'
import { Readable } from 'stream'
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
  httpRequest: vi.fn(),
  httpsRequest: vi.fn(),
  lookup: vi.fn(),
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
}))

vi.mock('dns/promises', () => ({
  lookup: mocks.lookup,
}))

vi.mock('http', () => ({
  request: mocks.httpRequest,
}))

vi.mock('https', () => ({
  request: mocks.httpsRequest,
}))

function responseWithBody(
  chunks: Array<Buffer | Uint8Array | string>,
  init?: { statusCode?: number; headers?: Record<string, string> },
): Readable & {
  statusCode: number
  headers: Record<string, string>
  destroy: () => void
} {
  const response = Readable.from(chunks) as Readable & {
    statusCode: number
    headers: Record<string, string>
    destroy: () => void
  }
  response.statusCode = init?.statusCode ?? 200
  response.headers = init?.headers ?? {}
  return response
}

function mockRequestWithResponse(
  response: ReturnType<typeof responseWithBody>,
): void {
  const implementation = (
    _url: URL,
    _options: Record<string, unknown>,
    callback: (response: ReturnType<typeof responseWithBody>) => void,
  ) => {
    callback(response)
    return {
      end: vi.fn(),
      once: vi.fn(),
    }
  }
  mocks.httpRequest.mockImplementation(implementation)
  mocks.httpsRequest.mockImplementation(implementation)
}

function mockPublicDns(address = '93.184.216.34'): void {
  mocks.lookup.mockResolvedValue([{ address, family: 4 }])
}

type RequestLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string,
    family: number,
  ) => void,
) => void

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
    mockPublicDns()
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
    mockPublicDns()
  })

  afterEach(() => {
    rmSync(mocks.downloadsPath, { recursive: true, force: true })
  })

  it('rejects downloads with an oversized content-length before showing a save dialog', async () => {
    mockRequestWithResponse(
      responseWithBody([''], {
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
    mockRequestWithResponse(
      responseWithBody(Array.from({ length: 101 }, () => chunk)),
    )
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    const result = await downloadUrlToFile({
      url: 'https://example.com/large.bin',
    })

    expect(result).toEqual({ success: false, error: 'download_too_large' })
    expect(existsSync(filePath)).toBe(false)
  })

  it('pins the allowed preflight DNS address into the request lookup', async () => {
    const filePath = join(mocks.downloadsPath, 'image.jpg')
    mockPublicDns('93.184.216.34')
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    let lookupResult:
      | {
          error: NodeJS.ErrnoException | null
          address: string
          family: number
        }
      | undefined
    mocks.httpRequest.mockImplementation(
      (
        _url: URL,
        options: { lookup?: RequestLookup },
        callback: (response: ReturnType<typeof responseWithBody>) => void,
      ) => {
        options.lookup?.(
          'rebind.example',
          {},
          (
            error: NodeJS.ErrnoException | null,
            address: string,
            family: number,
          ) => {
            lookupResult = { error, address, family }
          },
        )
        callback(responseWithBody(['ok']))
        return {
          end: vi.fn(),
          once: vi.fn(),
        }
      },
    )

    const result = await downloadUrlToFile({
      url: 'http://rebind.example/image.jpg',
    })

    expect(result.success).toBe(true)
    expect(mocks.lookup).toHaveBeenCalledTimes(1)
    expect(lookupResult).toEqual({
      error: null,
      address: '93.184.216.34',
      family: 4,
    })
  })

  it('pins HTTPS requests and preserves the original hostname for SNI', async () => {
    const filePath = join(mocks.downloadsPath, 'image.jpg')
    mockPublicDns('93.184.216.34')
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    let requestOptions:
      | {
          lookup?: RequestLookup
          servername?: string
        }
      | undefined
    mocks.httpsRequest.mockImplementation(
      (
        _url: URL,
        options: typeof requestOptions,
        callback: (response: ReturnType<typeof responseWithBody>) => void,
      ) => {
        requestOptions = options
        callback(responseWithBody(['ok']))
        return {
          end: vi.fn(),
          once: vi.fn(),
        }
      },
    )

    const result = await downloadUrlToFile({
      url: 'https://cdn.example/image.jpg',
    })

    expect(result.success).toBe(true)
    expect(requestOptions?.servername).toBe('cdn.example')
    expect(requestOptions?.lookup).toBeTypeOf('function')
  })

  it('drains the response when the save dialog is canceled', async () => {
    const response = responseWithBody(['ok'])
    const resume = vi.spyOn(response, 'resume')
    mockRequestWithResponse(response)
    mocks.showSaveDialog.mockResolvedValue({ canceled: true })

    const result = await downloadUrlToFile({
      url: 'https://example.com/image.jpg',
    })

    expect(result).toEqual({ success: false, canceled: true })
    expect(resume).toHaveBeenCalled()
  })
})

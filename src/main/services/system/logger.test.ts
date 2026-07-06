import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getLogFilePath,
  logError,
  logInfo,
  logWarn,
  logWarnQuiet,
  readRecentLogs,
  reportRendererError,
} from './logger'

const mocks = vi.hoisted(() => ({
  userDataPath: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.userDataPath),
  },
}))

describe('logger resource limits', () => {
  beforeEach(() => {
    mocks.userDataPath = mkdtempSync(join(tmpdir(), 'livo-logger-test-'))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(mocks.userDataPath, { recursive: true, force: true })
  })

  it('clamps recent log reads to a bounded line count', () => {
    const lines = Array.from({ length: 2500 }, (_, index) => `line-${index}`)
    writeFileSync(getLogFilePath(), lines.join('\n'), 'utf-8')

    const content = readRecentLogs(999999)
    const resultLines = content.split('\n')

    expect(resultLines).toHaveLength(2000)
    expect(resultLines[0]).toBe('line-500')
    expect(resultLines.at(-1)).toBe('line-2499')
  })

  it('truncates renderer error payloads before writing them to the log', () => {
    reportRendererError({
      source: 'renderer',
      message: 'm'.repeat(20 * 1024),
      stack: 's'.repeat(70 * 1024),
      componentStack: 'c'.repeat(70 * 1024),
    })

    const content = readRecentLogs(10)

    expect(content).toContain('[renderer-error]')
    expect(content).toContain('[truncated ')
    expect(content.length).toBeLessThan(160 * 1024)
  })

  it('redacts secrets from recent log reads', () => {
    writeFileSync(
      getLogFilePath(),
      [
        'Authorization: Bearer raw-bearer-token',
        'Cookie: sid=raw-cookie; token=raw-cookie-token',
        'Set-Cookie: session=raw-set-cookie; HttpOnly',
        'url=https://user:pass@example.com/path?api_key=raw-api-key&ok=1',
        'apiKey="raw-api-key-field" refresh_token=raw-refresh-token',
      ].join('\n'),
      'utf-8',
    )

    const content = readRecentLogs(20)

    expect(content).not.toContain('raw-bearer-token')
    expect(content).not.toContain('raw-cookie')
    expect(content).not.toContain('raw-set-cookie')
    expect(content).not.toContain('user:pass')
    expect(content).not.toContain('raw-api-key')
    expect(content).not.toContain('raw-api-key-field')
    expect(content).not.toContain('raw-refresh-token')
    expect(content).toContain('ok=1')
    expect(content).toContain('[redacted]')
  })

  it('redacts secrets before persisting new log entries', () => {
    logInfo('auth header', 'Authorization: Bearer raw-info-token')
    logWarn('cookie header', 'Cookie: sid=raw-warn-cookie')
    logWarnQuiet(
      'signed url',
      'https://user:pass@example.com/file?signature=raw-signature&ok=1',
    )
    logError('object detail', {
      apiKey: 'raw-error-api-key',
      nested: {
        refresh_token: 'raw-refresh-token',
      },
    })

    const persisted = readFileSync(getLogFilePath(), 'utf-8')

    expect(persisted).not.toContain('raw-info-token')
    expect(persisted).not.toContain('raw-warn-cookie')
    expect(persisted).not.toContain('user:pass')
    expect(persisted).not.toContain('raw-signature')
    expect(persisted).not.toContain('raw-error-api-key')
    expect(persisted).not.toContain('raw-refresh-token')
    expect(persisted).toContain('ok=1')
    expect(persisted).toContain('[redacted]')
  })

  it('redacts renderer-reported error payloads in exported recent logs', () => {
    reportRendererError({
      source: 'renderer',
      message: 'Authorization: Bearer raw-renderer-token',
      stack:
        'Error: failed https://user:pass@example.com/path?access_token=raw-access-token',
      componentStack: 'Cookie: sid=raw-renderer-cookie',
    })

    const content = readRecentLogs(20)

    expect(content).not.toContain('raw-renderer-token')
    expect(content).not.toContain('user:pass')
    expect(content).not.toContain('raw-access-token')
    expect(content).not.toContain('raw-renderer-cookie')
    expect(content).toContain('[renderer-error]')
    expect(content).toContain('[redacted]')
  })
})

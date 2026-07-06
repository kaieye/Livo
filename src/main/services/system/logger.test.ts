import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLogFilePath, readRecentLogs, reportRendererError } from './logger'

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
})

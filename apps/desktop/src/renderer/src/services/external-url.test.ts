import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { openExternalUrl, openExternalUrlSafe } from './external-url'

describe('openExternalUrl', () => {
  const originalApi = globalThis.window?.api

  beforeEach(() => {
    // jsdom doesn't expose `window.api`; the service falls back to `window.open`.
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalApi) {
      ;(globalThis as unknown as { window: { api: unknown } }).window.api =
        originalApi
    }
  })

  it('blocks javascript: URLs', async () => {
    const result = await openExternalUrl('javascript:alert(1)')
    expect(result.blocked).toBe(true)
    expect(result.opened).toBe(false)
  })

  it('blocks data: URLs', async () => {
    const result = await openExternalUrl('data:text/html,<script>x</script>')
    expect(result.blocked).toBe(true)
  })

  it('blocks file: URLs', async () => {
    const result = await openExternalUrl('file:///etc/passwd')
    expect(result.blocked).toBe(true)
  })

  it('blocks malformed URLs', async () => {
    const result = await openExternalUrl('not a url at all')
    expect(result.blocked).toBe(true)
  })

  it('flags URLs containing @ (a phishing classic) as suspicious', async () => {
    // jsdom's `URL` parser accepts these, but our heuristic should flag them.
    const result = await openExternalUrl('https://google.com@evil.example/')
    // If URL parser rejects, blocked=true; otherwise suspicious=true. Either
    // way the URL must NOT silently open.
    expect(result.blocked || result.suspicious).toBe(true)
  })
})

describe('openExternalUrlSafe', () => {
  it('refuses to open javascript: URLs without ever calling the IPC', async () => {
    const openExternal = vi.fn()
    ;(globalThis as unknown as { window: { api?: unknown } }).window = {
      ...((globalThis as unknown as { window: object }).window ?? {}),
      api: { app: { openExternal } },
    }
    const result = await openExternalUrlSafe('javascript:alert(1)')
    expect(result).toEqual({ opened: false })
    expect(openExternal).not.toHaveBeenCalled()
  })
})

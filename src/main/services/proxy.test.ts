import { describe, expect, it } from 'vitest'
import {
  buildElectronProxyConfig,
  getNormalizedProxyState,
  normalizeProxyUrl,
} from './proxy'

describe('proxy helpers', () => {
  it('normalizes valid proxy urls', () => {
    expect(normalizeProxyUrl('http://localhost:8080')).toBe(
      'http://localhost:8080',
    )
    expect(normalizeProxyUrl('https://example.com:443/path?q=1')).toBe(
      'https://example.com',
    )
    expect(normalizeProxyUrl('socks5://127.0.0.1:1080')).toBe(
      'socks5://127.0.0.1:1080',
    )
  })

  it('rejects invalid proxy urls', () => {
    expect(normalizeProxyUrl('')).toBe('')
    expect(normalizeProxyUrl('invalid-proxy')).toBe('')
    expect(normalizeProxyUrl('ftp://example.com:21')).toBe('')
  })

  it('falls back to system mode when custom proxy is invalid', () => {
    expect(
      getNormalizedProxyState({ proxyMode: 'custom', proxyUrl: 'invalid' }),
    ).toEqual({
      mode: 'system',
      proxyUrl: '',
    })
  })

  it('builds electron proxy config for custom mode', () => {
    expect(
      buildElectronProxyConfig({
        mode: 'custom',
        proxyUrl: 'http://localhost:8080',
      }),
    ).toEqual({
      proxyRules: 'http://localhost:8080,direct://',
      proxyBypassRules: '<local>',
    })
  })
})

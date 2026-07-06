import { describe, expect, it } from 'vitest'
import { isLoginWindowUrlAllowed } from './login-window-policy'

describe('login-window-policy', () => {
  const policy = {
    allowedOrigins: ['https://auth.example.com'],
    allowedHostSuffixes: ['accounts.google.com', 'youtube.com'],
  }

  it('allows exact origins and provider host suffixes', () => {
    expect(
      isLoginWindowUrlAllowed('https://auth.example.com/oauth/start', policy),
    ).toBe(true)
    expect(
      isLoginWindowUrlAllowed(
        'https://accounts.google.com/o/oauth2/v2/auth',
        policy,
      ),
    ).toBe(true)
    expect(
      isLoginWindowUrlAllowed('https://m.youtube.com/account', policy),
    ).toBe(true)
  })

  it('blocks unsafe protocols, credentials, and lookalike hosts', () => {
    expect(isLoginWindowUrlAllowed('http://accounts.google.com/', policy)).toBe(
      false,
    )
    expect(
      isLoginWindowUrlAllowed('https://user:pass@accounts.google.com/', policy),
    ).toBe(false)
    expect(
      isLoginWindowUrlAllowed(
        'https://accounts.google.com.evil.example/',
        policy,
      ),
    ).toBe(false)
    expect(isLoginWindowUrlAllowed('javascript:alert(1)', policy)).toBe(false)
  })
})

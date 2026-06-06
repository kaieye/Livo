import { describe, expect, it } from 'vitest'
import { getFeedRefreshIssueLabel } from './feed-refresh-issue'

const t = (key: string, options?: Record<string, string>) =>
  options?.error ? `${key}:${options.error}` : key

describe('getFeedRefreshIssueLabel', () => {
  it('returns a user-facing label for stale feed refresh failures', () => {
    expect(
      getFeedRefreshIssueLabel(
        {
          lastRefreshStatus: 'failed',
          lastRefreshAttemptedAt: 1_000,
          lastRefreshError: '源站返回 HTTP 403',
        },
        t,
        true,
        3_700_000,
      ),
    ).toBe('sidebar.feedRefreshFailed:源站返回 HTTP 403')
  })

  it('hides non-failures, disabled badges, and fresh failures inside grace time', () => {
    expect(
      getFeedRefreshIssueLabel({ lastRefreshStatus: 'succeeded' }, t, true),
    ).toBeNull()
    expect(
      getFeedRefreshIssueLabel({ lastRefreshStatus: 'failed' }, t, false),
    ).toBeNull()
    expect(
      getFeedRefreshIssueLabel(
        {
          lastRefreshStatus: 'failed',
          lastRefreshAttemptedAt: 1_000,
          lastRefreshError: 'HTTP 403',
        },
        t,
        true,
        1_000 + 30 * 60 * 1000,
      ),
    ).toBeNull()
  })

  it('uses fallback text when failed feed has no user error', () => {
    expect(
      getFeedRefreshIssueLabel(
        {
          lastRefreshStatus: 'failed',
          lastRefreshAttemptedAt: 1_000,
          lastRefreshError: '   ',
        },
        t,
        true,
        3_700_000,
      ),
    ).toBe('sidebar.feedRefreshFailedFallback')
  })
})

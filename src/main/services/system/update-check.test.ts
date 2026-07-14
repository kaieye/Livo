import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getVersion: vi.fn(() => '0.0.9'),
  logWarn: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getVersion: mocks.getVersion },
  session: { defaultSession: { fetch: mocks.fetch } },
}))

vi.mock('./logger', () => ({
  logWarn: mocks.logWarn,
}))

import { checkForAppUpdates, resetUpdateCheckCache } from './update-check'
import { __internal } from './update-check-internal'

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.getVersion.mockReturnValue('0.0.9')
  mocks.logWarn.mockReset()
  resetUpdateCheckCache()
})

describe('compareVersions', () => {
  it('compares numeric versions', () => {
    expect(__internal.compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0)
    expect(__internal.compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(__internal.compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
  })

  it('ignores v prefix', () => {
    expect(__internal.compareVersions('v1.2.0', '1.1.9')).toBeGreaterThan(0)
  })
})

describe('pickWindowsInstallerAsset', () => {
  it('prefers the installer asset matching the release version', () => {
    expect(
      __internal.pickWindowsInstallerAsset(
        [
          {
            name: 'Livo-Setup-1.0.0.exe',
            browser_download_url: 'https://example.com/old.exe',
            size: 1,
          },
          {
            name: 'Livo-Setup-1.2.0.zip',
            browser_download_url: 'https://example.com/new.zip',
            size: 2,
          },
        ],
        'v1.2.0',
      ),
    ).toEqual({
      name: 'Livo-Setup-1.2.0.zip',
      downloadUrl: 'https://example.com/new.zip',
      size: 2,
    })
  })

  it('ignores non-installer release assets', () => {
    expect(
      __internal.pickWindowsInstallerAsset(
        [
          {
            name: 'latest.yml',
            browser_download_url: 'https://example.com/latest.yml',
          },
          {
            name: 'Livo-Setup-1.0.0.exe',
            browser_download_url: 'https://example.com/setup.exe',
          },
        ],
        '1.0.0',
      )?.downloadUrl,
    ).toBe('https://example.com/setup.exe')
  })
})

describe('checkForAppUpdates', () => {
  it('uses the GitHub release API while quota is available', async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tag_name: 'v1.2.0',
          html_url: 'https://github.com/kaieye/Livo/releases/tag/v1.2.0',
          published_at: '2026-07-03T01:57:06Z',
          assets: [
            {
              name: 'Livo-Setup-1.2.0-win-x64.exe',
              browser_download_url:
                'https://github.com/kaieye/Livo/releases/download/v1.2.0/Livo-Setup-1.2.0-win-x64.exe',
              size: 123456,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const result = await checkForAppUpdates(true)

    expect(result).toMatchObject({
      hasUpdate: true,
      latestVersion: '1.2.0',
      installerAssetName: 'Livo-Setup-1.2.0-win-x64.exe',
      installerSize: 123456,
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to public release pages when the GitHub API rate limit is exhausted', async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'API rate limit exceeded for 203.0.113.10.',
          }),
          {
            status: 403,
            headers: {
              'content-type': 'application/json',
              'x-ratelimit-remaining': '0',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <feed xmlns="http://www.w3.org/2005/Atom">
            <entry>
              <id>tag:github.com,2008:Repository/1/v1.2.0</id>
              <updated>2026-07-03T01:57:06Z</updated>
              <link rel="alternate" type="text/html" href="https://github.com/kaieye/Livo/releases/tag/v1.2.0"/>
              <title>Livo v1.2.0</title>
            </entry>
          </feed>`,
          { status: 200, headers: { 'content-type': 'application/atom+xml' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<a href="/kaieye/Livo/releases/download/v1.2.0/Livo-Setup-1.2.0-win-x64.exe">
            Livo-Setup-1.2.0-win-x64.exe
          </a>`,
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'content-length': '123456' },
        }),
      )

    const result = await checkForAppUpdates(true)

    expect(result).toMatchObject({
      hasUpdate: true,
      currentVersion: '0.0.9',
      latestVersion: '1.2.0',
      releaseUrl: 'https://github.com/kaieye/Livo/releases/tag/v1.2.0',
      installerAssetName: 'Livo-Setup-1.2.0-win-x64.exe',
      installerDownloadUrl:
        'https://github.com/kaieye/Livo/releases/download/v1.2.0/Livo-Setup-1.2.0-win-x64.exe',
      installerSize: 123456,
      publishedAt: '2026-07-03T01:57:06Z',
    })
    expect(result).not.toHaveProperty('error')
  })
})

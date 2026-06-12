import { describe, expect, it } from 'vitest'

import { __internal } from './update-check-internal'

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

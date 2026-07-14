import { spawnSync } from 'child_process'
import { basename, dirname } from 'path'

const DEVELOPER_ID_APPLICATION_PREFIX = 'Authority=Developer ID Application:'

export function findMacAppBundlePath(executablePath: string): string | null {
  const macOSDirectory = dirname(executablePath)
  const contentsDirectory = dirname(macOSDirectory)
  if (basename(contentsDirectory) !== 'Contents') return null

  const appBundlePath = dirname(contentsDirectory)
  return appBundlePath.endsWith('.app') ? appBundlePath : null
}

export function isEligibleMacUpdateSignature(signatureInfo: string): boolean {
  const hasDeveloperIdApplication = signatureInfo
    .split(/\r?\n/)
    .some((line) => line.startsWith(DEVELOPER_ID_APPLICATION_PREFIX))
  const teamIdentifier = signatureInfo.match(/^TeamIdentifier=(.+)$/m)?.[1]

  return (
    hasDeveloperIdApplication &&
    !!teamIdentifier &&
    teamIdentifier.trim().toLowerCase() !== 'not set'
  )
}

/**
 * Squirrel.Mac verifies an update against the currently running bundle's code
 * requirement. Ad-hoc builds use their exact cdhash as that requirement, so a
 * different build can never satisfy it. Only advertise in-place updates for a
 * stable Developer ID Application signature.
 */
export function canInstallMacUpdateInPlace(
  executablePath = process.execPath,
): boolean {
  const appBundlePath = findMacAppBundlePath(executablePath)
  if (!appBundlePath) return false

  const result = spawnSync(
    '/usr/bin/codesign',
    ['-dv', '--verbose=4', appBundlePath],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  )
  if (result.error || result.status !== 0) return false

  return isEligibleMacUpdateSignature(
    `${result.stdout || ''}\n${result.stderr || ''}`,
  )
}

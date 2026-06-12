import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses'

function resolveElectronBinaryPath(context) {
  const productName = context.packager.appInfo.productFilename

  switch (context.electronPlatformName) {
    case 'darwin':
      return join(
        context.appOutDir,
        `${productName}.app`,
        'Contents',
        'MacOS',
        productName,
      )
    case 'win32':
      return join(context.appOutDir, `${productName}.exe`)
    default:
      return join(context.appOutDir, productName)
  }
}

export default async function afterPack(context) {
  const electronBinaryPath = resolveElectronBinaryPath(context)
  if (!existsSync(electronBinaryPath)) {
    console.warn(`[afterPack] Electron binary not found: ${electronBinaryPath}`)
    return
  }

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  })

  if (context.electronPlatformName === 'win32') {
    await pruneBetterSqlite3BuildArtifacts(context.appOutDir)
  }
}

async function pruneBetterSqlite3BuildArtifacts(appOutDir) {
  const moduleDir = join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
  )
  const releaseDir = join(moduleDir, 'build', 'Release')
  const keepNativeModule = join(releaseDir, 'better_sqlite3.node')

  if (!existsSync(moduleDir) || !existsSync(keepNativeModule)) return

  const entriesToRemove = [
    join(moduleDir, 'deps'),
    join(moduleDir, 'src'),
    join(moduleDir, 'build', 'deps'),
    join(releaseDir, 'obj'),
    join(releaseDir, 'better_sqlite3.exp'),
    join(releaseDir, 'better_sqlite3.iobj'),
    join(releaseDir, 'better_sqlite3.ipdb'),
    join(releaseDir, 'better_sqlite3.lib'),
    join(releaseDir, 'sqlite3.lib'),
    join(releaseDir, 'test_extension.exp'),
    join(releaseDir, 'test_extension.iobj'),
    join(releaseDir, 'test_extension.ipdb'),
    join(releaseDir, 'test_extension.lib'),
    join(releaseDir, 'test_extension.node'),
    join(moduleDir, 'build', 'better_sqlite3.vcxproj'),
    join(moduleDir, 'build', 'better_sqlite3.vcxproj.filters'),
    join(moduleDir, 'build', 'test_extension.vcxproj'),
    join(moduleDir, 'build', 'test_extension.vcxproj.filters'),
  ]

  await Promise.all(
    entriesToRemove.map((entry) => rm(entry, { recursive: true, force: true })),
  )
}

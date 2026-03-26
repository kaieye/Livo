import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses'

function resolveElectronBinaryPath(context) {
  const productName = context.packager.appInfo.productFilename

  switch (context.electronPlatformName) {
    case 'darwin':
      return join(context.appOutDir, `${productName}.app`, 'Contents', 'MacOS', productName)
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
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  })
}

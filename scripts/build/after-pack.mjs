import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

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

function resolveAppBundlePath(context) {
  const productName = context.packager.appInfo.productFilename
  return join(context.appOutDir, `${productName}.app`)
}

async function adhocSignMacOS(context) {
  const appBundlePath = resolveAppBundlePath(context)
  if (!existsSync(appBundlePath)) {
    console.warn(`[afterPack] App bundle not found: ${appBundlePath}`)
    return
  }

  const entitlements = resolve(
    context.packager.projectDir,
    'build/entitlements.mac.plist',
  )
  const entitlementsPath = existsSync(entitlements) ? entitlements : undefined

  // flipFuses 修改了 Electron 二进制的 __TEXT 段，破坏了原始签名。
  // macOS 26+ 在启动时校验代码签名，未重新签名会导致 SIGKILL (Code Signature Invalid)。
  // 这里对整个 .app bundle 做 ad-hoc 重新签名，并附带 entitlements 以减少
  // macOS 在运行时弹出的网络/文件访问权限询问。
  try {
    const cmd = entitlementsPath
      ? `codesign --force --deep --sign - --options runtime --entitlements "${entitlementsPath}" "${appBundlePath}"`
      : `codesign --force --deep --sign - "${appBundlePath}"`
    execSync(cmd, { stdio: 'pipe' })
    console.log('[afterPack] Ad-hoc signed macOS app bundle')
  } catch (err) {
    console.warn(`[afterPack] Ad-hoc signing failed: ${err.message}`)
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
    [FuseV1Options.EnableCookieEncryption]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  })

  // macOS: 翻转 fuses 后需要重新签名，否则 macOS 26+ 会因签名失效而 kill 进程
  if (context.electronPlatformName === 'darwin') {
    await adhocSignMacOS(context)
  }

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

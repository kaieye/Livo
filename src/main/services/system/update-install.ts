import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

import { app, session } from 'electron'

import type { AppUpdateInstallResult } from '../../../shared/types/index'
import { sanitizeSuggestedFileName } from './download'
import { logInfo, logWarn } from './logger'
import { assertNetworkFetchUrl } from './network-url-policy'
import { checkForAppUpdates } from './update-check'

const MAX_REDIRECTS = 5

function getCurrentInstallPath(): string | null {
  if (process.platform !== 'win32') return null
  if (!app.isPackaged) return null
  return dirname(app.getPath('exe'))
}

function buildInstallerFileName(
  assetName: string | undefined,
  version: string | undefined,
): string {
  const safeName = sanitizeSuggestedFileName(
    assetName || `Livo-Setup-${version || 'update'}.zip`,
  )
  return ['.exe', '.zip'].includes(extname(safeName).toLowerCase())
    ? safeName
    : `${safeName}.zip`
}

async function cleanUpdateDirectory(updateDir: string): Promise<void> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(updateDir)
  } catch {
    return
  }

  await Promise.all(
    entries
      .filter(
        (entry) =>
          /^Livo-Setup-.+\.(exe|zip)$/i.test(entry) || entry === 'next',
      )
      .map((entry) => fs.rm(join(updateDir, entry), { force: true })),
  )
}

async function findInstallerExecutable(dir: string): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isFile() && /Livo .+程序\.exe$/i.test(entry.name)) {
      return entryPath
    }
    if (entry.isDirectory()) {
      const nested = await findInstallerExecutable(entryPath)
      if (nested) return nested
    }
  }
  return null
}

async function extractInstallerZip(zipPath: string): Promise<string> {
  const extractDir = join(dirname(zipPath), 'next')
  await fs.rm(extractDir, { recursive: true, force: true })
  await fs.mkdir(extractDir, { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
        zipPath,
        extractDir,
      ],
      { windowsHide: true, stdio: 'ignore' },
    )
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`解压更新安装包失败：退出码 ${code ?? 'unknown'}`))
    })
  })

  const installerPath = await findInstallerExecutable(extractDir)
  if (!installerPath) {
    throw new Error('解压后的更新包中未找到 Livo 安装程序')
  }
  return installerPath
}

async function resolveInstallerExecutable(filePath: string): Promise<string> {
  if (extname(filePath).toLowerCase() !== '.zip') return filePath
  return extractInstallerZip(filePath)
}

async function fetchInstallerToFile(
  url: string,
  filePath: string,
  redirectDepth = 0,
): Promise<void> {
  if (redirectDepth > MAX_REDIRECTS) {
    throw new Error('下载更新失败：重定向次数过多')
  }

  const safeUrl = await assertNetworkFetchUrl(url)
  const response = await session.defaultSession.fetch(safeUrl, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': `Livo/${app.getVersion()}`,
    },
    redirect: 'manual',
  })

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get('location')
  ) {
    const nextUrl = new URL(response.headers.get('location') || '', safeUrl)
      .href
    await assertNetworkFetchUrl(nextUrl)
    return fetchInstallerToFile(nextUrl, filePath, redirectDepth + 1)
  }

  if (!response.ok) {
    throw new Error(`下载更新失败：HTTP ${response.status}`)
  }

  const data = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(filePath, data)
}

async function downloadInstaller(
  url: string,
  assetName: string | undefined,
  version: string | undefined,
): Promise<string> {
  const updateDir = join(app.getPath('userData'), 'updates')
  await fs.mkdir(updateDir, { recursive: true })
  await cleanUpdateDirectory(updateDir)

  const filePath = join(updateDir, buildInstallerFileName(assetName, version))
  await fetchInstallerToFile(url, filePath)
  return filePath
}

function startSilentInstaller(
  installerPath: string,
  installPath: string,
): void {
  const child = spawn(
    installerPath,
    ['--silent-install', installPath, '--silent-update'],
    {
      cwd: dirname(installerPath),
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        LIVO_SILENT_INSTALL: installPath,
        LIVO_SILENT_UPDATE: '1',
      },
    },
  )
  child.unref()
}

export async function installAppUpdate(): Promise<AppUpdateInstallResult> {
  const installPath = getCurrentInstallPath()
  if (!installPath) {
    return {
      success: false,
      error: app.isPackaged
        ? '当前静默更新仅支持 Windows'
        : '开发模式无法执行静默更新，请打包后验证',
    }
  }

  try {
    const updateInfo = await checkForAppUpdates()
    if (!updateInfo.hasUpdate) {
      return { success: false, error: '当前没有可安装的新版本' }
    }
    if (!updateInfo.installerDownloadUrl) {
      return {
        success: false,
        error: '最新发布未包含 Livo-Setup 安装包',
      }
    }

    const installerPath = await downloadInstaller(
      updateInfo.installerDownloadUrl,
      updateInfo.installerAssetName,
      updateInfo.latestVersion,
    )
    const installerExecutablePath =
      await resolveInstallerExecutable(installerPath)
    logInfo('[update-install] installer downloaded', {
      installerPath,
      installerExecutable: basename(installerExecutablePath),
      installPath,
      version: updateInfo.latestVersion,
    })

    startSilentInstaller(installerExecutablePath, installPath)
    setTimeout(() => app.quit(), 250)
    return { success: true }
  } catch (error) {
    logWarn('[update-install] failed to install update', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

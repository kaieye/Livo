import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

import { app, session } from 'electron'

import type {
  AppUpdateInstallResult,
  AppUpdateState,
} from '../../../shared/types/index'
import { sanitizeSuggestedFileName } from './download'
import { logInfo, logWarn } from './logger'
import { assertNetworkFetchUrl } from './network-url-policy'
import { checkForAppUpdates } from './update-check'

const MAX_REDIRECTS = 5
const MAX_INSTALLER_BYTES = 300 * 1024 * 1024
const DOWNLOAD_TEMP_SUFFIX = '.download'
const GITHUB_RELEASE_OWNER = 'kaieye'
const GITHUB_RELEASE_REPO = 'Livo'

type InstallerKind = 'exe' | 'zip'
type UpdateStateCallback = (state: AppUpdateState) => void

function getCurrentInstallPath(): string | null {
  if (process.platform !== 'win32') return null
  if (!app.isPackaged) return null
  return dirname(app.getPath('exe'))
}

function isInstallerAssetName(fileName: string): boolean {
  return /^Livo-Setup-.+\.(exe|zip)$/i.test(fileName)
}

function getInstallerKind(filePath: string): InstallerKind | null {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.exe') return 'exe'
  if (extension === '.zip') return 'zip'
  return null
}

function buildInstallerFileName(
  assetName: string | undefined,
  version: string | undefined,
): string {
  const safeName = sanitizeSuggestedFileName(
    assetName || `Livo-Setup-${version || 'update'}.zip`,
  )
  const fileName = getInstallerKind(safeName) ? safeName : `${safeName}.zip`
  if (!isInstallerAssetName(fileName)) {
    throw new Error('更新安装包名称无效')
  }
  return fileName
}

function assertInstallerByteLength(
  byteLength: number | undefined,
  message = '更新安装包过大',
): void {
  if (typeof byteLength !== 'number') return
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    throw new Error('更新安装包大小无效')
  }
  if (byteLength > MAX_INSTALLER_BYTES) {
    throw new Error(message)
  }
}

function getResponseContentLength(response: Response): number | undefined {
  const raw = response.headers.get('content-length')
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function assertExpectedByteLength(
  actualBytes: number | undefined,
  expectedBytes: number | undefined,
): void {
  if (typeof actualBytes !== 'number' || typeof expectedBytes !== 'number') {
    return
  }
  if (actualBytes !== expectedBytes) {
    throw new Error('下载更新失败：安装包大小不匹配')
  }
}

function assertInstallerDownloadUrl(url: string, assetName: string): void {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
    const downloadedName = segments[segments.length - 1] || ''
    const [owner, repo, releases, download] = segments

    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.hostname.toLowerCase() !== 'github.com' ||
      owner !== GITHUB_RELEASE_OWNER ||
      repo !== GITHUB_RELEASE_REPO ||
      releases !== 'releases' ||
      download !== 'download' ||
      downloadedName.toLowerCase() !== assetName.toLowerCase()
    ) {
      throw new Error('invalid update download URL')
    }
  } catch {
    throw new Error('更新安装包下载地址无效')
  }
}

function assertInstallerAssetMetadata(
  url: string,
  assetName: string,
  expectedBytes: number | undefined,
): void {
  assertInstallerByteLength(expectedBytes)
  assertInstallerDownloadUrl(url, assetName)
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
      .map((entry) =>
        fs.rm(join(updateDir, entry), {
          force: true,
          recursive: entry === 'next',
        }),
      ),
  )
}

async function assertInstallerFileShape(
  filePath: string,
  expectedKind?: InstallerKind,
): Promise<InstallerKind> {
  const kind = getInstallerKind(filePath)
  if (!kind || (expectedKind && kind !== expectedKind)) {
    throw new Error('更新安装包类型无效')
  }

  const stats = await fs.stat(filePath)
  assertInstallerByteLength(stats.size)
  if (stats.size === 0) {
    throw new Error('更新安装包为空')
  }

  const handle = await fs.open(filePath, 'r')
  try {
    const header = Buffer.alloc(4)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    if (kind === 'exe') {
      if (bytesRead < 2 || header[0] !== 0x4d || header[1] !== 0x5a) {
        throw new Error('更新安装程序格式无效')
      }
    } else if (
      bytesRead < 4 ||
      header[0] !== 0x50 ||
      header[1] !== 0x4b ||
      !(
        (header[2] === 0x03 && header[3] === 0x04) ||
        (header[2] === 0x05 && header[3] === 0x06) ||
        (header[2] === 0x07 && header[3] === 0x08)
      )
    ) {
      throw new Error('更新压缩包格式无效')
    }
  } finally {
    await handle.close()
  }

  return kind
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
  await assertInstallerFileShape(zipPath, 'zip')
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
  await assertInstallerFileShape(installerPath, 'exe')
  return installerPath
}

async function resolveInstallerExecutable(filePath: string): Promise<string> {
  const kind = await assertInstallerFileShape(filePath)
  if (kind !== 'zip') return filePath
  return extractInstallerZip(filePath)
}

async function writeResponseBodyToFile(
  response: Response,
  filePath: string,
  expectedBytes: number | undefined,
  onState: UpdateStateCallback,
): Promise<void> {
  const contentLength = getResponseContentLength(response)
  assertInstallerByteLength(contentLength, '下载更新失败：安装包过大')
  assertExpectedByteLength(contentLength, expectedBytes)

  const progressTotal = contentLength ?? expectedBytes
  const reportProgress = (transferred: number): void => {
    onState({
      status: 'downloading',
      percent:
        typeof progressTotal === 'number' && progressTotal > 0
          ? Math.min(100, (transferred / progressTotal) * 100)
          : undefined,
      transferred,
      total: progressTotal,
    })
  }
  reportProgress(0)

  const tempPath = `${filePath}${DOWNLOAD_TEMP_SUFFIX}`
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let totalBytes = 0
  const handle = await fs.open(tempPath, 'w')
  let caughtError: unknown

  try {
    reader = response.body?.getReader()
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer())
      totalBytes = buffer.length
      assertInstallerByteLength(totalBytes, '下载更新失败：安装包过大')
      assertExpectedByteLength(totalBytes, expectedBytes)
      await handle.writeFile(buffer)
      reportProgress(totalBytes)
    } else {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue

        const nextTotal = totalBytes + value.byteLength
        if (nextTotal > MAX_INSTALLER_BYTES) {
          await reader.cancel()
          throw new Error('下载更新失败：安装包过大')
        }

        await handle.write(Buffer.from(value))
        totalBytes = nextTotal
        reportProgress(totalBytes)
      }
      assertExpectedByteLength(totalBytes, expectedBytes)
    }
  } catch (error) {
    caughtError = error
  } finally {
    reader?.releaseLock()
    await handle.close()
  }

  if (caughtError) {
    await fs.rm(tempPath, { force: true })
    throw caughtError
  }

  await fs.rename(tempPath, filePath)
}

async function fetchInstallerToFile(
  url: string,
  filePath: string,
  expectedBytes: number | undefined,
  onState: UpdateStateCallback,
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
    return fetchInstallerToFile(
      nextUrl,
      filePath,
      expectedBytes,
      onState,
      redirectDepth + 1,
    )
  }

  if (!response.ok) {
    throw new Error(`下载更新失败：HTTP ${response.status}`)
  }

  await writeResponseBodyToFile(response, filePath, expectedBytes, onState)
}

async function downloadInstaller(
  url: string,
  assetName: string | undefined,
  version: string | undefined,
  expectedBytes: number | undefined,
  onState: UpdateStateCallback,
): Promise<string> {
  const updateDir = join(app.getPath('userData'), 'updates')
  const fileName = buildInstallerFileName(assetName, version)
  assertInstallerAssetMetadata(url, fileName, expectedBytes)

  await fs.mkdir(updateDir, { recursive: true })
  await cleanUpdateDirectory(updateDir)

  const filePath = join(updateDir, fileName)
  try {
    await fetchInstallerToFile(url, filePath, expectedBytes, onState)
    await assertInstallerFileShape(filePath)
  } catch (error) {
    await fs.rm(filePath, { force: true })
    throw error
  }
  return filePath
}

function startSilentInstaller(
  installerPath: string,
  installPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
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
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export async function installAppUpdate(
  onState: UpdateStateCallback = () => {},
): Promise<AppUpdateInstallResult> {
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
      updateInfo.installerSize,
      onState,
    )
    const installerExecutablePath =
      await resolveInstallerExecutable(installerPath)
    logInfo('[update-install] installer downloaded', {
      installerPath,
      installerExecutable: basename(installerExecutablePath),
      installPath,
      version: updateInfo.latestVersion,
    })

    onState({ status: 'installing' })
    await startSilentInstaller(installerExecutablePath, installPath)
    setTimeout(() => app.quit(), 250)
    return { success: true }
  } catch (error) {
    logWarn('[update-install] failed to install update', error)
    const message = error instanceof Error ? error.message : String(error)
    onState({ status: 'error', error: message })
    return { success: false, error: message }
  }
}

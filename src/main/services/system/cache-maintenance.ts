import { app, session } from 'electron'
import { existsSync, type Dirent } from 'fs'
import { promises as fsp } from 'fs'
import { join } from 'path'
import type { AppSettings } from '../../../shared/types/index'
import { logInfo, logWarnQuiet } from './logger'

const CACHE_MAINTENANCE_INTERVAL_MS = 10 * 60 * 1000
const CACHE_TRIM_BUFFER_BYTES = 50 * 1024 * 1024

interface CacheFileEntry {
  path: string
  size: number
  mtimeMs: number
}

function getCacheDirectoryPath(): string {
  return join(app.getPath('userData'), 'cache')
}

function getCodeCacheDirectoryPath(): string {
  return join(app.getPath('userData'), 'Code Cache')
}

async function getDirectorySize(path: string): Promise<number> {
  try {
    const entries = await fsp.readdir(path, { withFileTypes: true })
    let total = 0
    for (const entry of entries) {
      const entryPath = join(path, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        total += await getDirectorySize(entryPath)
        continue
      }
      if (entry.isFile()) {
        try {
          total += (await fsp.stat(entryPath)).size
        } catch {
          // Ignore best-effort sizing failures.
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

async function collectFilesRecursive(
  path: string,
  result: CacheFileEntry[] = [],
): Promise<CacheFileEntry[]> {
  let entries: Dirent[] = []
  try {
    entries = await fsp.readdir(path, { withFileTypes: true })
  } catch {
    return result
  }

  for (const entry of entries) {
    const entryPath = join(path, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      await collectFilesRecursive(entryPath, result)
      continue
    }
    if (!entry.isFile()) continue
    try {
      const stats = await fsp.stat(entryPath)
      result.push({
        path: entryPath,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      })
    } catch {
      // Ignore best-effort stat failures.
    }
  }
  return result
}

async function pruneDirectoryToLimit(
  path: string,
  limitBytes: number,
): Promise<number> {
  if (!existsSync(path) || limitBytes <= 0) return 0
  const currentSize = await getDirectorySize(path)
  if (currentSize <= limitBytes) return 0

  const targetSize = Math.max(0, limitBytes - CACHE_TRIM_BUFFER_BYTES)
  const files = await collectFilesRecursive(path)
  files.sort((a, b) => a.mtimeMs - b.mtimeMs)

  let removedBytes = 0
  let remainingSize = currentSize
  for (const file of files) {
    try {
      await fsp.rm(file.path, { force: true })
      removedBytes += file.size
      remainingSize -= file.size
      if (remainingSize <= targetSize) break
    } catch {
      // Ignore best-effort file cleanup failures.
    }
  }

  return removedBytes
}

async function trimCodeCache(limitBytes: number): Promise<number> {
  const codeCachePath = getCodeCacheDirectoryPath()
  if (!existsSync(codeCachePath) || limitBytes <= 0) return 0
  const currentSize = await getDirectorySize(codeCachePath)
  if (currentSize <= limitBytes) return 0
  try {
    await fsp.rm(codeCachePath, { recursive: true, force: true })
    return currentSize
  } catch (error) {
    logWarnQuiet('[cache-maintenance] failed to clear code cache', error)
    return 0
  }
}

export async function runCacheMaintenance(
  settings: AppSettings,
): Promise<void> {
  if (!settings.data.autoCleanCache) return

  const cacheLimitBytes =
    Math.max(0, settings.data.cacheSizeLimitMB || 0) * 1024 * 1024
  const codeCacheLimitBytes =
    Math.max(0, settings.data.codeCacheLimitMB || 0) * 1024 * 1024

  const [cacheRemovedBytes, codeCacheRemovedBytes] = await Promise.all([
    cacheLimitBytes > 0
      ? pruneDirectoryToLimit(getCacheDirectoryPath(), cacheLimitBytes)
      : Promise.resolve(0),
    codeCacheLimitBytes > 0
      ? trimCodeCache(codeCacheLimitBytes)
      : Promise.resolve(0),
  ])

  if (cacheRemovedBytes > 0) {
    logInfo('[cache-maintenance] trimmed cache directory', {
      removedBytes: cacheRemovedBytes,
      limitBytes: cacheLimitBytes,
    })
    try {
      await session.defaultSession.clearCache()
    } catch {
      // Ignore best-effort Electron cache clearing failures after file trim.
    }
  }

  if (codeCacheRemovedBytes > 0) {
    logInfo('[cache-maintenance] cleared code cache', {
      removedBytes: codeCacheRemovedBytes,
      limitBytes: codeCacheLimitBytes,
    })
  }
}

export function startCacheMaintenance(
  getCurrentSettings: () => AppSettings,
): () => void {
  const run = () => {
    void runCacheMaintenance(getCurrentSettings()).catch((error) => {
      logWarnQuiet('[cache-maintenance] periodic maintenance failed', error)
    })
  }

  run()
  const timer = setInterval(run, CACHE_MAINTENANCE_INTERVAL_MS)
  return () => clearInterval(timer)
}

export const __internal = {
  getDirectorySize,
  collectFilesRecursive,
  pruneDirectoryToLimit,
}

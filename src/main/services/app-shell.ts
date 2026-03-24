import { app, session, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { getLogDirectoryPath } from './logger'

function ensureDirectory(path: string): string {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
  return path
}

export function getUserDataDirectoryPath(): string {
  return ensureDirectory(app.getPath('userData'))
}

export function getAppCacheDirectoryPath(): string {
  return ensureDirectory(join(getUserDataDirectoryPath(), 'cache'))
}

export function getLogDirectory(): string {
  return getLogDirectoryPath()
}

export function getDirectorySize(path: string): number {
  if (!existsSync(path)) return 0
  let total = 0
  for (const entry of readdirSync(path)) {
    const entryPath = join(path, entry)
    try {
      const stats = statSync(entryPath)
      total += stats.isDirectory() ? getDirectorySize(entryPath) : stats.size
    } catch {
      // Ignore best-effort sizing failures.
    }
  }
  return total
}

export async function openDirectory(
  path: string,
): Promise<{ success: boolean; error?: string }> {
  const target = ensureDirectory(path)
  const error = await shell.openPath(target)
  return error ? { success: false, error } : { success: true }
}

function removeChildren(path: string): number {
  if (!existsSync(path)) return 0
  let removed = 0
  for (const entry of readdirSync(path)) {
    const entryPath = join(path, entry)
    try {
      const stats = statSync(entryPath)
      removed += stats.isDirectory() ? 1 : stats.size
      rmSync(entryPath, { recursive: true, force: true })
    } catch {
      // Ignore best-effort cleanup failures.
    }
  }
  return removed
}

export async function clearApplicationCache(): Promise<{
  success: boolean
  clearedBytes: number
  error?: string
}> {
  let clearedBytes = 0
  const cacheDir = getAppCacheDirectoryPath()
  clearedBytes += removeChildren(cacheDir)

  try {
    await session.defaultSession.clearCache()
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers'],
      quotas: ['temporary'],
    })
  } catch (error) {
    return {
      success: false,
      clearedBytes,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  return { success: true, clearedBytes }
}

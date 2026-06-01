import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type RssParser from 'rss-parser'

type ParsedFeed = RssParser.Output<Record<string, any>>

export interface AggregatorDiagnostics {
  upstreamsTried?: string[]
  cacheHit?: boolean
  freshnessMs?: number
  lastError?: string
}

export interface AggregatorSnapshot {
  key: string
  source: 'direct' | 'local-agent' | 'private-aggregator'
  fetchedAt: number
  refreshedAt: number
  lastSuccessAt: number
  failureCount: number
  etag?: string
  lastModified?: string
  diagnostics?: AggregatorDiagnostics
  parsed: ParsedFeed
}

interface AggregatorStoreData {
  snapshots: Record<string, AggregatorSnapshot>
}

let cache: AggregatorStoreData | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

function getStorePath(): string {
  return join(app.getPath('userData'), 'data', 'aggregator-cache.json')
}

function ensureLoaded(): AggregatorStoreData {
  if (cache) return cache
  const storePath = getStorePath()
  try {
    if (existsSync(storePath)) {
      const raw = readFileSync(storePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AggregatorStoreData>
      cache = {
        snapshots: parsed.snapshots || {},
      }
      return cache
    }
  } catch {
    // Ignore and recreate below.
  }

  cache = { snapshots: {} }
  return cache
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const storePath = getStorePath()
    const dir = join(storePath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(storePath, JSON.stringify(ensureLoaded(), null, 2), 'utf-8')
  }, 250)
}

export function getAggregatorSnapshot(key: string): AggregatorSnapshot | null {
  return ensureLoaded().snapshots[key] || null
}

export function setAggregatorSnapshot(snapshot: AggregatorSnapshot): void {
  ensureLoaded().snapshots[snapshot.key] = snapshot
  scheduleSave()
}

export function touchAggregatorFailure(
  key: string,
  source: AggregatorSnapshot['source'],
  error: unknown,
): void {
  const store = ensureLoaded()
  const current = store.snapshots[key]
  if (!current) return
  store.snapshots[key] = {
    ...current,
    source,
    refreshedAt: Date.now(),
    failureCount: (current.failureCount || 0) + 1,
    diagnostics: {
      ...(current.diagnostics || {}),
      lastError: String(error || ''),
    },
  }
  scheduleSave()
}

export function pruneAggregatorSnapshots(maxAgeMs: number): void {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return
  const now = Date.now()
  const store = ensureLoaded()
  let changed = false
  for (const [key, snapshot] of Object.entries(store.snapshots)) {
    if (now - (snapshot.lastSuccessAt || snapshot.fetchedAt || 0) <= maxAgeMs)
      continue
    delete store.snapshots[key]
    changed = true
  }
  if (changed) scheduleSave()
}

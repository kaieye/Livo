/**
 * SettingsProvider — canonical owner of application settings state.
 *
 * Replaces the module-level `let cachedSettings` singleton in
 * settings-handlers.ts.  Callers use `provider.get()` for the current
 * snapshot and `provider.onChange(fn)` to react to updates instead of
 * capturing stale references.
 */
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { AppSettings } from '../../../shared/types'
import {
  cloneDefaultSettings,
  mergeSettings,
  normalizeSettings,
} from '../../../shared/settings'
import { getEventBus } from './event-bus'
import { applyProxySettings } from './proxy'

export type SettingsChangeListener = (settings: AppSettings) => void

export class SettingsProvider {
  private current: AppSettings | null = null

  private readonly listeners = new Set<SettingsChangeListener>()

  /** Return the canonical settings snapshot. Loads from disk on first call. */
  get(): AppSettings {
    if (!this.current) this.current = this.loadFromDisk()
    return this.current
  }

  /**
   * Apply a partial update, persist to disk, re-apply proxy config,
   * broadcast to renderer windows, and notify in-process listeners.
   */
  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = this.get()
    this.current = mergeSettings(current, partial)
    this.persist()
    await applyProxySettings(this.current)
    getEventBus().send('settings:changed', this.current)
    this.notifyListeners()
    return this.current
  }

  /**
   * Register a listener that fires whenever settings change.
   * Returns an unsubscribe function.
   */
  onChange(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ---- internal ----

  private loadFromDisk(): AppSettings {
    const settingsPath = getSettingsPath()
    if (existsSync(settingsPath)) {
      try {
        const raw = readFileSync(settingsPath, 'utf-8')
        return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>)
      } catch {
        return cloneDefaultSettings()
      }
    }
    return cloneDefaultSettings()
  }

  private persist(): void {
    const settingsPath = getSettingsPath()
    const dir = join(settingsPath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(this.current!, null, 2))
  }

  private notifyListeners(): void {
    for (const fn of this.listeners) {
      try {
        fn(this.current!)
      } catch {
        // Don't let a broken listener break the update chain.
      }
    }
  }
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'data', 'settings.json')
}

/** Singleton instance — created once in settings-handlers.ts. */
export const settingsProvider = new SettingsProvider()

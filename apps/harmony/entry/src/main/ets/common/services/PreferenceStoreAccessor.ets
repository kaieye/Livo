import preferences from '@ohos.data.preferences'
import { AppContextService } from './AppContextService'

const SETTINGS_NAME = 'livo_harmony_settings'

export class PreferenceStoreAccessor {
  private static pref: preferences.Preferences | null = null

  static async getPreferences(): Promise<preferences.Preferences> {
    if (!PreferenceStoreAccessor.pref) {
      try {
        PreferenceStoreAccessor.pref = await preferences.getPreferences(AppContextService.getContext(), SETTINGS_NAME)
      } catch (error) {
        throw new Error(`读取 Preferences 失败：${error instanceof Error ? error.message : 'unknown error'}`)
      }
    }

    return PreferenceStoreAccessor.pref!
  }
}

/**
 * Read a JSON array under `key`. On any parse / type error returns []. Never throws.
 *
 * Callers should still apply their own item-level normalization / dedup after.
 */
export async function loadJsonArray<T>(key: string): Promise<T[]> {
  try {
    const pref = await PreferenceStoreAccessor.getPreferences()
    const raw = await pref.get(key, '[]')
    const text = typeof raw === 'string' ? raw : '[]'
    const parsed = JSON.parse(text) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

/**
 * Write a JSON array under `key` and flush. Throws on put/flush failure with `errorMessage`
 * as the fallback if the underlying error is not an Error instance.
 *
 * Callers wanting silent failure (e.g. ChatHistoryStore) should wrap this in try/catch.
 */
export async function saveJsonArray<T>(
  key: string,
  items: T[],
  errorMessage: string = '保存失败',
): Promise<void> {
  const pref = await PreferenceStoreAccessor.getPreferences()
  try {
    await pref.put(key, JSON.stringify(items))
    await pref.flush()
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : errorMessage)
  }
}

import { ThemePalette, ThemeService } from '../services/ThemeService'
import { SettingsStore } from '../services/SettingsStore'

/**
 * Shared theme loading helper — eliminates duplicated loadTheme boilerplate
 * across settings panels and standalone pages.
 */
export async function loadThemeForComponent(): Promise<ThemePalette> {
  const settings = await SettingsStore.load()
  return ThemeService.resolvePalette(settings)
}

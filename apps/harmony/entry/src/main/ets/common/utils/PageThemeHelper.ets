import { ThemePalette, ThemeService } from '../services/ThemeService'
import { AppPreferenceService } from '../services/AppPreferenceService'

/**
 * Shared theme loading helper — eliminates duplicated loadTheme boilerplate
 * across settings panels and standalone pages.
 */
export async function loadThemeForComponent(): Promise<ThemePalette> {
  const settings = await AppPreferenceService.loadSettings()
  return ThemeService.resolvePalette(settings)
}

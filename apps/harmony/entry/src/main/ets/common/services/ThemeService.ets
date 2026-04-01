import ConfigurationConstant from '@ohos.app.ability.ConfigurationConstant'
import resourceManager from '@ohos.resourceManager'
import { HarmonySettings, ThemeAccent } from '../models/LivoModels'
import { AppContextService } from './AppContextService'

export interface ThemePalette {
  isDark: boolean
  background: string
  surface: string
  elevated: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  divider: string
  accent: string
  accentText: string
  tabBarBackground: string
  tabBarInactive: string
  dragHandle: string
}

const DARK_PALETTE: ThemePalette = {
  isDark: true,
  background: '#111418',
  surface: '#1A1F25',
  elevated: '#242A33',
  textPrimary: '#FFFFFF',
  textSecondary: '#D3D8E1',
  textMuted: '#8F98A7',
  divider: '#313845',
  accent: '#FF6A00',
  accentText: '#FFFFFF',
  tabBarBackground: 'rgba(18, 22, 27, 0.92)',
  tabBarInactive: '#C6CDD8',
  dragHandle: 'rgba(255, 255, 255, 0.22)',
}

const LIGHT_PALETTE: ThemePalette = {
  isDark: false,
  background: '#F3F5F8',
  surface: '#FBFCFD',
  elevated: '#EDF1F5',
  textPrimary: '#111111',
  textSecondary: '#4B5563',
  textMuted: '#7B8595',
  divider: '#D8DFE7',
  accent: '#FF6A00',
  accentText: '#FFFFFF',
  tabBarBackground: 'rgba(248, 250, 252, 0.92)',
  tabBarInactive: '#6B7280',
  dragHandle: 'rgba(15, 23, 42, 0.18)',
}

export class ThemeService {
  private static cachedPalette: ThemePalette = LIGHT_PALETTE

  private static resolveAccentColor(accent: ThemeAccent): string {
    switch (accent) {
      case 'blue':
        return '#2563EB'
      case 'red':
        return '#DC2626'
      case 'pink':
        return '#DB2777'
      case 'green':
        return '#16A34A'
      default:
        return '#FF6A00'
    }
  }

  private static clonePalette(source: ThemePalette): ThemePalette {
    return {
      isDark: source.isDark,
      background: source.background,
      surface: source.surface,
      elevated: source.elevated,
      textPrimary: source.textPrimary,
      textSecondary: source.textSecondary,
      textMuted: source.textMuted,
      divider: source.divider,
      accent: source.accent,
      accentText: source.accentText,
      tabBarBackground: source.tabBarBackground,
      tabBarInactive: source.tabBarInactive,
      dragHandle: source.dragHandle,
    }
  }

  static currentPalette(): ThemePalette {
    return ThemeService.clonePalette(ThemeService.cachedPalette)
  }

  static darkPalette(): ThemePalette {
    return ThemeService.clonePalette(DARK_PALETTE)
  }

  static lightPalette(): ThemePalette {
    return ThemeService.clonePalette(LIGHT_PALETTE)
  }

  static async resolvePalette(settings: HarmonySettings): Promise<ThemePalette> {
    let resolved: ThemePalette
    if (settings.themeMode === 'dark') {
      resolved = ThemeService.darkPalette()
    } else if (settings.themeMode === 'light') {
      resolved = ThemeService.lightPalette()
    } else {
      resolved = (await ThemeService.isSystemDarkMode())
        ? ThemeService.darkPalette()
        : ThemeService.lightPalette()
    }

    resolved.accent = ThemeService.resolveAccentColor(settings.themeAccent)
    resolved.accentText = '#FFFFFF'
    ThemeService.applyColorMode(settings)

    ThemeService.cachedPalette = ThemeService.clonePalette(resolved)
    return resolved
  }

  private static applyColorMode(settings: HarmonySettings): void {
    try {
      const context = AppContextService.getContext()
      if (settings.themeMode === 'dark') {
        context.setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_DARK)
      } else if (settings.themeMode === 'light') {
        context.setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT)
      } else {
        context.setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET)
      }
    } catch (_error) {}
  }

  private static async isSystemDarkMode(): Promise<boolean> {
    try {
      const context = AppContextService.getContext()
      const configuration = await context.resourceManager.getConfiguration()
      return configuration.colorMode === resourceManager.ColorMode.DARK
    } catch (error) {
      return false
    }
  }
}

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
  background: '#000000',
  surface: '#1D1D22',
  elevated: '#2A2A2F',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D1D6',
  textMuted: '#8E8E93',
  divider: '#2A2A30',
  accent: '#FF6A00',
  accentText: '#FFFFFF',
  tabBarBackground: '#0B0B0F',
  tabBarInactive: '#D1D1D6',
  dragHandle: 'rgba(255, 255, 255, 0.22)',
}

const LIGHT_PALETTE: ThemePalette = {
  isDark: false,
  background: '#F5F5F7',
  surface: '#FFFFFF',
  elevated: '#EEF1F6',
  textPrimary: '#111111',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  divider: '#E5E7EB',
  accent: '#FF6A00',
  accentText: '#FFFFFF',
  tabBarBackground: 'rgba(255, 255, 255, 0.88)',
  tabBarInactive: '#6B7280',
  dragHandle: 'rgba(15, 23, 42, 0.18)',
}

export class ThemeService {
  private static cachedPalette: ThemePalette = DARK_PALETTE

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
      return true
    }
  }
}

import resourceManager from "@ohos:resourceManager";
import type { HarmonySettings } from '../models/LivoModels';
import { AppContextService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppContextService";
export interface ThemePalette {
    isDark: boolean;
    background: string;
    surface: string;
    elevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    divider: string;
    accent: string;
    accentText: string;
    tabBarBackground: string;
    tabBarInactive: string;
    dragHandle: string;
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
    tabBarBackground: 'rgba(8, 8, 10, 0.88)',
    tabBarInactive: '#D1D1D6',
    dragHandle: 'rgba(255, 255, 255, 0.22)',
};
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
};
export class ThemeService {
    static darkPalette(): ThemePalette {
        return {
            isDark: DARK_PALETTE.isDark,
            background: DARK_PALETTE.background,
            surface: DARK_PALETTE.surface,
            elevated: DARK_PALETTE.elevated,
            textPrimary: DARK_PALETTE.textPrimary,
            textSecondary: DARK_PALETTE.textSecondary,
            textMuted: DARK_PALETTE.textMuted,
            divider: DARK_PALETTE.divider,
            accent: DARK_PALETTE.accent,
            accentText: DARK_PALETTE.accentText,
            tabBarBackground: DARK_PALETTE.tabBarBackground,
            tabBarInactive: DARK_PALETTE.tabBarInactive,
            dragHandle: DARK_PALETTE.dragHandle,
        };
    }
    static lightPalette(): ThemePalette {
        return {
            isDark: LIGHT_PALETTE.isDark,
            background: LIGHT_PALETTE.background,
            surface: LIGHT_PALETTE.surface,
            elevated: LIGHT_PALETTE.elevated,
            textPrimary: LIGHT_PALETTE.textPrimary,
            textSecondary: LIGHT_PALETTE.textSecondary,
            textMuted: LIGHT_PALETTE.textMuted,
            divider: LIGHT_PALETTE.divider,
            accent: LIGHT_PALETTE.accent,
            accentText: LIGHT_PALETTE.accentText,
            tabBarBackground: LIGHT_PALETTE.tabBarBackground,
            tabBarInactive: LIGHT_PALETTE.tabBarInactive,
            dragHandle: LIGHT_PALETTE.dragHandle,
        };
    }
    static async resolvePalette(settings: HarmonySettings): Promise<ThemePalette> {
        if (settings.themeMode === 'dark') {
            return ThemeService.darkPalette();
        }
        if (settings.themeMode === 'light') {
            return ThemeService.lightPalette();
        }
        return (await ThemeService.isSystemDarkMode())
            ? ThemeService.darkPalette()
            : ThemeService.lightPalette();
    }
    private static async isSystemDarkMode(): Promise<boolean> {
        try {
            const context = AppContextService.getContext();
            const configuration = await context.resourceManager.getConfiguration();
            return configuration.colorMode === resourceManager.ColorMode.DARK;
        }
        catch (error) {
            return true;
        }
    }
}

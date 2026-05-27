export interface SystemBarTheme {
  isDark: boolean
  background: string
}

export interface ResolvedSystemBarStyle {
  statusBarColor: string
  navigationBarColor: string
  isStatusBarLightIcon: boolean
  statusBarContentColor: string
}

export function resolveSystemBarStyle(
  theme: SystemBarTheme,
): ResolvedSystemBarStyle {
  return {
    statusBarColor: '#00000000',
    navigationBarColor: '#00000000',
    isStatusBarLightIcon: theme.isDark,
    statusBarContentColor: theme.isDark ? '#FFFFFF' : '#000000',
  }
}

export type ThemeMode = 'light' | 'dark' | 'system'

export function shouldRefreshThemeOnSystemColorModeChange(
  themeMode: ThemeMode,
): boolean {
  return themeMode === 'system'
}

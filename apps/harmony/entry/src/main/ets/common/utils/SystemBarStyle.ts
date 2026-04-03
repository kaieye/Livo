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

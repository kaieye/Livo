export type ThemeMode = 'light' | 'dark' | 'system'

export function shouldRefreshThemeOnSystemColorModeChange(
  themeMode: ThemeMode,
): boolean {
  return themeMode === 'system'
}

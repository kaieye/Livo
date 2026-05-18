export function accountCardRenderKey(
  provider: string,
  linked: boolean,
  displayName: string,
  error: string,
): string {
  return `${provider}|${linked ? '1' : '0'}|${displayName.trim()}|${error.trim()}`
}

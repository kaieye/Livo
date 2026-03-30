export type AccountNavigationProvider =
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'bilibili'

export function buildLinkNavigationFailureStatus(
  provider: AccountNavigationProvider,
  linked: boolean,
  displayName: string,
  message: string,
): {
  provider: AccountNavigationProvider
  linked: boolean
  displayName: string
  error: string
} {
  return {
    provider,
    linked,
    displayName,
    error: (message || '').trim() || '打开账号关联页面失败',
  }
}

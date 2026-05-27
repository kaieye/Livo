export type AccountLinkResultProvider =
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'bilibili'

export type AccountNavigationProvider = AccountLinkResultProvider

export type AccountBrowserCheckProvider = AccountLinkResultProvider

export type AccountLoginWebPolicyProvider = AccountLinkResultProvider

export interface AccountLinkStatusFields {
  linked: boolean
  displayName: string
  error: string
}

export interface AccountLinkResultState {
  provider: AccountLinkResultProvider | ''
  displayName: string
  linked: boolean
}

export function mergeStatusWithAccountLinkResult(
  provider: AccountLinkResultProvider,
  current: AccountLinkStatusFields,
  fallbackTitle: string,
  linkResult: AccountLinkResultState,
): AccountLinkStatusFields {
  if (!linkResult.linked || linkResult.provider !== provider) {
    return current
  }

  if (current.linked && !current.error) {
    return {
      linked: true,
      displayName:
        current.displayName ||
        linkResult.displayName ||
        `${fallbackTitle} 已关联`,
      error: '',
    }
  }

  return {
    linked: true,
    displayName:
      linkResult.displayName ||
      current.displayName ||
      `${fallbackTitle} 已关联`,
    error: '',
  }
}

export function accountCardRenderKey(
  provider: string,
  linked: boolean,
  displayName: string,
  error: string,
): string {
  return `${provider}|${linked ? '1' : '0'}|${displayName.trim()}|${error.trim()}`
}

export function accountCardHeadlineStatus(
  linked: boolean,
  displayName: string,
  error: string,
): string {
  if (linked) {
    return (displayName || '').trim() || '已关联'
  }

  if ((error || '').trim()) {
    return '需处理'
  }

  return '未关联'
}

export function resolveExternalBrowserCheckMessage(
  provider: AccountBrowserCheckProvider,
  linked: boolean,
  displayName: string,
): string {
  const normalizedDisplayName = (displayName || '').trim()
  if (linked) {
    return normalizedDisplayName
      ? `检查完成：已关联 ${normalizedDisplayName}`
      : '检查完成：已关联'
  }

  if (provider === 'youtube') {
    return '未检测到可自动确认的 YouTube 登录状态，请在浏览器完成登录后手动保存账号名'
  }

  return '未检测到可自动确认的登录状态'
}

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

export interface AccountLoginWebPolicy {
  allowWindowOpenMethod: boolean
  usesExternalBrowser: boolean
}

export function resolveAccountLoginWebPolicy(
  provider: AccountLoginWebPolicyProvider,
): AccountLoginWebPolicy {
  return {
    allowWindowOpenMethod: provider === 'youtube',
    usesExternalBrowser: false,
  }
}

export function buildAccountLoginRenderExitMessage(
  provider: AccountLoginWebPolicyProvider,
  _reason: number,
): string {
  if (provider === 'youtube') {
    return 'Google 登录页渲染进程异常退出，请重试'
  }
  return '登录页渲染进程异常退出，请重试'
}

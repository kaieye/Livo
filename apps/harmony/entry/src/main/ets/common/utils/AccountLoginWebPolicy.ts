export type AccountLoginWebPolicyProvider =
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'bilibili'

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

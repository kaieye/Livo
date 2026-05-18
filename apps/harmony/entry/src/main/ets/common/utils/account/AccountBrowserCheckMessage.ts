type AccountBrowserCheckProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

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

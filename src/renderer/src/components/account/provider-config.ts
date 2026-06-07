import type { AccountProvider } from '../../../../shared/types'

// Visual + descriptive metadata for each supported login provider.
// Shared between AccountsSettings (management surface) and AccountLoginPage
// (standalone login flow) so the two stay in sync.
export interface ProviderConfig {
  provider: AccountProvider
  name: string
  colorClass: string
  description: string
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    provider: 'youtube',
    name: 'YouTube',
    colorClass: 'text-red-500',
    description: '关联 YouTube 账号，可获取订阅列表和播放历史。',
  },
  {
    provider: 'x',
    name: 'X / Twitter',
    colorClass: 'text-slate-700 dark:text-slate-200',
    description: '关联 X/Twitter 账号，可获取时间线和关注列表。',
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    colorClass: 'text-pink-500',
    description: '关联 Instagram 账号，可获取动态和关注列表。',
  },
  {
    provider: 'bilibili',
    name: 'Bilibili',
    colorClass: 'text-sky-500',
    description: '关联 B站账号，可一键导入关注列表和获取动态订阅。',
  },
]

export function findProviderConfig(
  provider: AccountProvider,
): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find((c) => c.provider === provider)
}

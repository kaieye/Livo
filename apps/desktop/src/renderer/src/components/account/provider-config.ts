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
    description: '用于关联 YouTube 会话并获取账号名称。',
  },
  {
    provider: 'x',
    name: 'X / Twitter',
    colorClass: 'text-slate-700 dark:text-slate-200',
    description: '用于关联 X 会话并获取账号名称。',
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    colorClass: 'text-pink-500',
    description: '用于关联 Instagram 会话并获取账号名称。',
  },
  {
    provider: 'bilibili',
    name: 'Bilibili',
    colorClass: 'text-sky-500',
    description: '用于关联 Bilibili 会话，可一键导入关注列表。',
  },
]

export function findProviderConfig(
  provider: AccountProvider,
): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find((c) => c.provider === provider)
}

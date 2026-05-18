import { AccountProvider } from '../../models/LivoModels'
import { ThemePalette } from '../../services/ThemeService'

// 账号提供方的展示元数据集中在这里。新增一个 provider 只需要追加一条记录，
// 而不必再去四处更新散落在 panel 里的 switch 分支。
export interface AccountProviderDefinition {
  provider: AccountProvider
  title: string
}

interface AccountProviderCatalogEntry {
  provider: AccountProvider
  title: string
  badgeBackground: string
}

const ACCOUNT_PROVIDER_CATALOG: AccountProviderCatalogEntry[] = [
  {
    provider: 'youtube',
    title: 'YouTube',
    badgeBackground: '#FEE2E2',
  },
  {
    provider: 'x',
    title: 'X / Twitter',
    badgeBackground: '',
  },
  {
    provider: 'instagram',
    title: 'Instagram',
    badgeBackground: '#FCE7F3',
  },
  {
    provider: 'bilibili',
    title: 'Bilibili',
    badgeBackground: '#E0F2FE',
  },
]

function lookup(provider: AccountProvider): AccountProviderCatalogEntry {
  const matched = ACCOUNT_PROVIDER_CATALOG.find(
    (entry: AccountProviderCatalogEntry) => entry.provider === provider,
  )
  return matched ? matched : ACCOUNT_PROVIDER_CATALOG[0]
}

export function listAccountProviderDefinitions(): AccountProviderDefinition[] {
  return ACCOUNT_PROVIDER_CATALOG.map((entry: AccountProviderCatalogEntry) => {
    const definition: AccountProviderDefinition = {
      provider: entry.provider,
      title: entry.title,
    }
    return definition
  })
}

export function accountProviderTitle(provider: AccountProvider): string {
  return lookup(provider).title
}

export function accountProviderBadgeResource(provider: AccountProvider): Resource {
  switch (provider) {
    case 'youtube':
      return $r('app.media.account_youtube')
    case 'x':
      return $r('app.media.account_x')
    case 'instagram':
      return $r('app.media.account_instagram')
    case 'bilibili':
      return $r('app.media.account_bilibili')
    default:
      return $r('app.media.account_x')
  }
}

export function accountProviderBadgeBackground(
  provider: AccountProvider,
  theme: ThemePalette,
): string {
  const entry = lookup(provider)
  return entry.badgeBackground ? entry.badgeBackground : theme.elevated
}

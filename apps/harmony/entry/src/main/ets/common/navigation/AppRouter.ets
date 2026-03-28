import router from '@ohos.router'
import { FeedViewType } from '../models/LivoModels'

export interface RouteDefinition {
  home: string
  subscriptions: string
  discover: string
  discoverSubscribeConfig: string
  discoverPreview: string
  articleDetail: string
  settings: string
  generalSettings: string
  appearanceSettings: string
  dataControlSettings: string
  privacySettings: string
  aboutSettings: string
  feedDetail: string
}

export const ROUTES: RouteDefinition = {
  home: 'pages/Index',
  subscriptions: 'pages/Subscriptions',
  discover: 'pages/Discover',
  discoverSubscribeConfig: 'pages/DiscoverSubscribeConfig',
  discoverPreview: 'pages/DiscoverPreview',
  articleDetail: 'pages/ArticleDetail',
  settings: 'pages/Settings',
  generalSettings: 'pages/GeneralSettings',
  appearanceSettings: 'pages/AppearanceSettings',
  dataControlSettings: 'pages/DataControlSettings',
  privacySettings: 'pages/PrivacySettings',
  aboutSettings: 'pages/AboutSettings',
  feedDetail: 'pages/FeedDetail',
}

export type RootTabId = 'home' | 'subscriptions' | 'discover' | 'settings'

export interface RootTabDefinition {
  id: RootTabId
  label: string
  route: string
}

export interface RootTabRouteParams {
  rootTab: RootTabId
}

export interface DiscoverPreviewRouteParams {
  targetUrl: string
  targetTitle: string
  targetView: FeedViewType
  siteUrl: string
  description: string
  sourceKind: string
  category: string
}

export interface DiscoverSubscribeConfigRouteParams {
  targetUrl: string
  targetTitle: string
  targetView: FeedViewType
  siteUrl: string
  description: string
  sourceKind: string
  category: string
}

class RootTabItem implements RootTabDefinition {
  id: RootTabId = 'home'
  label: string = ''
  route: string = ''
}

export const ROOT_TABS: RootTabDefinition[] = [
  (() => {
    const item = new RootTabItem()
    item.id = 'home'
    item.label = '首页'
    item.route = ROUTES.home
    return item
  })(),
  (() => {
    const item = new RootTabItem()
    item.id = 'subscriptions'
    item.label = '订阅'
    item.route = ROUTES.subscriptions
    return item
  })(),
  (() => {
    const item = new RootTabItem()
    item.id = 'discover'
    item.label = '发现'
    item.route = ROUTES.discover
    return item
  })(),
  (() => {
    const item = new RootTabItem()
    item.id = 'settings'
    item.label = '设置'
    item.route = ROUTES.settings
    return item
  })(),
]

export function rootTabIndexForId(tabId: RootTabId): number {
  switch (tabId) {
    case 'subscriptions':
      return 1
    case 'discover':
      return 2
    case 'settings':
      return 3
    default:
      return 0
  }
}

export function rootTabIdForIndex(index: number): RootTabId {
  switch (index) {
    case 1:
      return 'subscriptions'
    case 2:
      return 'discover'
    case 3:
      return 'settings'
    default:
      return 'home'
  }
}

export function getStringParams(): Record<string, string> {
  const rawParams = router.getParams() as Record<string, Object | string | number | boolean | undefined | null>
  const normalized: Record<string, string> = {}
  if (!rawParams) {
    return normalized
  }

  Object.keys(rawParams).forEach((key: string) => {
    const value: Object | string | number | boolean | undefined | null = rawParams[key]
    if (value !== undefined && value !== null) {
      normalized[key] = `${value}`
    }
  })

  return normalized
}

export class RouterOptions {
  url: string = ''
  params?: Object = undefined
}

class EntryDetailParams {
  entryId: string = ''
  entryJson?: string = ''
}

class FeedDetailParams {
  feedId: string = ''
}

class DiscoverRouteParams {
  targetUrl: string = ''
  targetTitle: string = ''
  view: string = ''
  siteUrl: string = ''
  description: string = ''
  sourceKind: string = ''
  category: string = ''
}

function createRouterOptions(url: string, params?: Object): RouterOptions {
  const options = new RouterOptions()
  options.url = url
  options.params = params
  return options
}

function createRootTabRouteParams(tabId: RootTabId): RootTabRouteParams {
  const params = {} as RootTabRouteParams
  params.rootTab = tabId
  return params
}

export async function goBack(): Promise<void> {
  await router.back()
}

export async function openRootTab(tabId: RootTabId, replace: boolean = true): Promise<void> {
  const options = createRouterOptions(ROUTES.home, createRootTabRouteParams(tabId))
  if (replace) {
    await router.replaceUrl(options)
    return
  }

  await router.pushUrl(options)
}

export function getRequestedRootTabId(): RootTabId | undefined {
  const params = getStringParams()
  const requestedTab = params['rootTab']
  if (requestedTab === 'subscriptions' || requestedTab === 'discover' || requestedTab === 'settings' || requestedTab === 'home') {
    return requestedTab
  }

  return undefined
}

export async function openArticleDetail(entryId: string, entryJson?: string): Promise<void> {
  const params = new EntryDetailParams()
  params.entryId = entryId
  if (entryJson) {
    params.entryJson = entryJson
  }
  await router.pushUrl(createRouterOptions(ROUTES.articleDetail, params))
}

export async function openFeedDetail(feedId: string): Promise<void> {
  const params = new FeedDetailParams()
  params.feedId = feedId
  await router.pushUrl(createRouterOptions(ROUTES.feedDetail, params))
}

export async function openAppearanceSettings(): Promise<void> {
  await router.pushUrl(createRouterOptions(ROUTES.appearanceSettings))
}

export async function openGeneralSettings(): Promise<void> {
  await router.pushUrl(createRouterOptions(ROUTES.generalSettings))
}

export async function openDataControlSettings(): Promise<void> {
  await router.pushUrl(createRouterOptions(ROUTES.dataControlSettings))
}

export async function openPrivacySettings(): Promise<void> {
  await router.pushUrl(createRouterOptions(ROUTES.privacySettings))
}

export async function openAboutSettings(): Promise<void> {
  await router.pushUrl(createRouterOptions(ROUTES.aboutSettings))
}

export async function openDiscoverPreview(params: DiscoverPreviewRouteParams): Promise<void> {
  const routeParams = new DiscoverRouteParams()
  routeParams.targetUrl = params.targetUrl
  routeParams.targetTitle = params.targetTitle
  routeParams.view = `${params.targetView}`
  routeParams.siteUrl = params.siteUrl
  routeParams.description = params.description
  routeParams.sourceKind = params.sourceKind
  routeParams.category = params.category
  await router.pushUrl(createRouterOptions(ROUTES.discoverPreview, routeParams))
}

export async function openDiscoverSubscribeConfig(
  params: DiscoverSubscribeConfigRouteParams,
): Promise<void> {
  const routeParams = new DiscoverRouteParams()
  routeParams.targetUrl = params.targetUrl
  routeParams.targetTitle = params.targetTitle
  routeParams.view = `${params.targetView}`
  routeParams.siteUrl = params.siteUrl
  routeParams.description = params.description
  routeParams.sourceKind = params.sourceKind
  routeParams.category = params.category
  await router.pushUrl(createRouterOptions(ROUTES.discoverSubscribeConfig, routeParams))
}

import window from '@ohos.window'
import { FeedViewType } from '../models/LivoModels'

export interface RouteDefinition {
  home: string
  subscriptions: string
  discover: string
  discoverSubscribeConfig: string
  discoverPreview: string
  articleDetail: string
  accountLogin: string
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
  accountLogin: 'pages/AccountLogin',
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
  let rawParams: Record<string, Object | string | number | boolean | undefined | null>
  try {
    rawParams = getAppRouter().getParams() as Record<string, Object | string | number | boolean | undefined | null>
  } catch (_error) {
    return {}
  }
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
  targetUrl: string = ''
  targetTitle: string = ''
  view: string = ''
  siteUrl: string = ''
  description: string = ''
  sourceKind: string = ''
  category: string = ''
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

class AccountLoginParams {
  provider: string = ''
  title: string = ''
  loginUrl: string = ''
}

function getAppRouter() {
  const mainWindow = AppStorage.get<window.Window>('WindowClass')
  if (!mainWindow) {
    throw new Error('应用主窗口尚未初始化')
  }

  try {
    return mainWindow.getUIContext().getRouter()
  } catch (error) {
    throw new Error(`获取路由实例失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

function createRootTabRouteParams(tabId: RootTabId): RootTabRouteParams {
  const params = {} as RootTabRouteParams
  params.rootTab = tabId
  return params
}

export async function goBack(): Promise<void> {
  try {
    getAppRouter().back()
  } catch (error) {
    throw new Error(`路由返回失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openRootTab(tabId: RootTabId, replace: boolean = true): Promise<void> {
  const options = createRouterOptions(ROUTES.home, createRootTabRouteParams(tabId))
  const appRouter = getAppRouter()
  try {
    if (replace) {
      await appRouter.replaceUrl(options)
      return
    }

    await appRouter.pushUrl(options)
  } catch (error) {
    throw new Error(`打开根标签失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
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
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.articleDetail, params))
  } catch (error) {
    throw new Error(`打开文章详情失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openAccountLogin(provider: string, title: string, loginUrl: string): Promise<void> {
  const params = new AccountLoginParams()
  params.provider = provider
  params.title = title
  params.loginUrl = loginUrl
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.accountLogin, params))
  } catch (error) {
    throw new Error(`打开账号关联页面失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}


export async function openFeedDetail(feedId: string): Promise<void> {
  const params = new FeedDetailParams()
  params.feedId = feedId
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.feedDetail, params))
  } catch (error) {
    throw new Error(`打开订阅详情失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openFeedDetailPreview(params: DiscoverPreviewRouteParams): Promise<void> {
  const routeParams = new FeedDetailParams()
  routeParams.targetUrl = params.targetUrl
  routeParams.targetTitle = params.targetTitle
  routeParams.view = `${params.targetView}`
  routeParams.siteUrl = params.siteUrl
  routeParams.description = params.description
  routeParams.sourceKind = params.sourceKind
  routeParams.category = params.category
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.feedDetail, routeParams))
  } catch (error) {
    throw new Error(`打开订阅预览失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openAppearanceSettings(): Promise<void> {
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.appearanceSettings))
  } catch (error) {
    throw new Error(`打开外观设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openGeneralSettings(): Promise<void> {
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.generalSettings))
  } catch (error) {
    throw new Error(`打开通用设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openDataControlSettings(): Promise<void> {
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.dataControlSettings))
  } catch (error) {
    throw new Error(`打开数据控制设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openPrivacySettings(): Promise<void> {
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.privacySettings))
  } catch (error) {
    throw new Error(`打开隐私设置失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openAboutSettings(): Promise<void> {
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.aboutSettings))
  } catch (error) {
    throw new Error(`打开关于页失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

export async function openDiscoverPreview(params: DiscoverPreviewRouteParams): Promise<void> {
  await openFeedDetailPreview(params)
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
  try {
    await getAppRouter().pushUrl(createRouterOptions(ROUTES.discoverSubscribeConfig, routeParams))
  } catch (error) {
    throw new Error(`打开订阅配置失败：${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

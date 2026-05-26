// Chrome 折叠进度 (顶部模式栏 + 底部 AudioMiniBar) 走 AppStorage,
// 让消费方通过 @StorageProp 订阅并在自身节点上跑 .animation(),
// 避免 Index 顶层在每帧滚动时被 @State 触发整树 rebuild。

export const HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY = 'homeModeRailEffectiveProgress'
export const HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY = 'homeAudioBarCollapseProgress'
// load-more 进行中标志:此前是 Index 的 @State,经 4 层 @Prop 传到 LoadMoreFooter。
// 每次写入触发整条 Shell → TabBody → IndexHomeRootContent 链路重新求值,
// 是"下滑加载更多特别卡"的根因。改走 AppStorage 后只有 LoadMoreFooter 的
// 宿主 (IndexHomeRootContent) 通过 @StorageProp 订阅,Index 本体不再 rebuild。
export const HOME_LOAD_MORE_IN_PROGRESS_KEY = 'homeLoadMoreInProgress'
// 每个栏目的 hasMore 状态。LoadMoreFooterSlot 始终常驻列表末尾,但需要根据
// 当前栏目是否"还有更多"切换显示文案:有更多 → spinner,没更多 → "没有更多了"。
// 走 AppStorage 让 HomeModeEntriesPage 直接 @StorageProp 订阅,避免通过 @Prop
// 层层传递引起 Index 整树 rebuild。
export const HOME_HAS_MORE_BY_MODE_KEY = 'homeHasMoreByMode'

export interface HomeHasMoreByMode {
  articles: boolean
  social: boolean
  pictures: boolean
  videos: boolean
}

export function createDefaultHomeHasMoreByMode(): HomeHasMoreByMode {
  return { articles: true, social: true, pictures: true, videos: true }
}

export function writeHomeModeRailEffectiveProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY, value)
}

export function writeHomeAudioBarCollapseProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY, value)
}

export function writeHomeLoadMoreInProgress(value: boolean): void {
  AppStorage.setOrCreate<boolean>(HOME_LOAD_MORE_IN_PROGRESS_KEY, value)
}

export function writeHomeHasMoreByMode(map: HomeHasMoreByMode): void {
  // 必须传新对象引用,否则 AppStorage 不视为变更,@StorageProp 不会刷新。
  AppStorage.setOrCreate<HomeHasMoreByMode>(HOME_HAS_MORE_BY_MODE_KEY, {
    articles: map.articles,
    social: map.social,
    pictures: map.pictures,
    videos: map.videos,
  })
}

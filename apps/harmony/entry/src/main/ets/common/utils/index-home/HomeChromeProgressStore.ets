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

export function writeHomeModeRailEffectiveProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY, value)
}

export function writeHomeAudioBarCollapseProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY, value)
}

export function writeHomeLoadMoreInProgress(value: boolean): void {
  AppStorage.setOrCreate<boolean>(HOME_LOAD_MORE_IN_PROGRESS_KEY, value)
}

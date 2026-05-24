// Chrome 折叠进度 (顶部模式栏 + 底部 AudioMiniBar) 走 AppStorage,
// 让消费方通过 @StorageProp 订阅并在自身节点上跑 .animation(),
// 避免 Index 顶层在每帧滚动时被 @State 触发整树 rebuild。

export const HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY = 'homeModeRailEffectiveProgress'
export const HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY = 'homeAudioBarCollapseProgress'

export function writeHomeModeRailEffectiveProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_MODE_RAIL_EFFECTIVE_PROGRESS_KEY, value)
}

export function writeHomeAudioBarCollapseProgress(value: number): void {
  AppStorage.setOrCreate<number>(HOME_AUDIO_BAR_COLLAPSE_PROGRESS_KEY, value)
}

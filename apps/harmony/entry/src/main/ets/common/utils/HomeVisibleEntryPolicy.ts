export type HomeVisibleEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 24
const HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP: number = 20
const HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP: number = 3
const HOME_VISIBLE_ENTRY_VIDEO_LOAD_MORE_STEP: number = 10

interface HomeVisibleEntryPreloadPolicy {
  preloadRemainingCount: number
  estimatedItemHeight: number
  estimatedVisibleItemCount: number
}

const HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    // 文章流此前会在距离尾部较远时就开始触发，体感像“滑到一半就加载”。
    // 这里按更接近真实卡片高度和视口容量估算，只在接近底部时再预取下一页。
    preloadRemainingCount: 2,
    estimatedItemHeight: 180,
    estimatedVisibleItemCount: 4,
  }

// 推文卡片实际高度通常在 320-420px (含头像/正文/媒体预览)；
// 旧值 220 会让触发阈值偏小，用户在仅滑过约 46% 内容时就被触发。
// 把估算高度抬到接近实测均值，让触发位置后移到接近列表末端。
const HOME_VISIBLE_ENTRY_SOCIAL_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 1,
    estimatedItemHeight: 380,
    estimatedVisibleItemCount: 2,
  }

// 图片卡片含轮播图，单卡常达 700-900px；旧组合 (520, remaining=10) 会让
// 触发位置过早 (~32%)。提高估算高度并降低剩余阈值，让触发更靠近底部。
const HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 1,
    estimatedItemHeight: 860,
    estimatedVisibleItemCount: 2,
  }

// 视频是双列网格，1 行容纳 2 个 item，行实际高度约 150-180px。旧值 280
// 把单 item 当成 1D 列来算，触发阈值过大，用户要滑过 55% 才触发；按
// 列除以 2 得到的 "每 item 等效行进度" 约 75-90px，这里取 140 兼顾
// 视觉余量，让触发提前到接近 30% 滚动进度。
const HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy = {
  preloadRemainingCount: 6,
  estimatedItemHeight: 150,
  estimatedVisibleItemCount: 4,
}

export function resolveHomeVisibleEntryInitialLimit(
  _mode: HomeVisibleEntryMode,
): number {
  return HOME_VISIBLE_ENTRY_INITIAL_LIMIT
}

export function resolveHomeVisibleEntryLoadMoreStep(
  mode?: HomeVisibleEntryMode,
): number {
  if (mode === 'pictures') {
    return HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP
  }
  if (mode === 'videos') {
    return HOME_VISIBLE_ENTRY_VIDEO_LOAD_MORE_STEP
  }
  return HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP
}

function resolveHomeVisibleEntryPreloadPolicy(
  mode: HomeVisibleEntryMode,
): HomeVisibleEntryPreloadPolicy {
  if (mode === 'social') {
    return HOME_VISIBLE_ENTRY_SOCIAL_PRELOAD_POLICY
  }
  if (mode === 'pictures') {
    return HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY
  }
  if (mode === 'videos') {
    return HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY
  }
  return HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY
}

export function shouldPreloadHomeVisibleEntries(
  mode: HomeVisibleEntryMode,
  currentScrollOffset: number,
  totalCount: number,
  visibleCount: number,
): boolean {
  if (visibleCount <= 0 || totalCount <= 0) {
    return false
  }
  const policy = resolveHomeVisibleEntryPreloadPolicy(mode)
  const preloadStartIndex = Math.max(
    0,
    visibleCount -
      policy.preloadRemainingCount -
      policy.estimatedVisibleItemCount,
  )
  return currentScrollOffset >= preloadStartIndex * policy.estimatedItemHeight
}

export type HomeVisibleEntryMode = 'articles' | 'social' | 'pictures' | 'videos'

const HOME_VISIBLE_ENTRY_INITIAL_LIMIT: number = 18
const HOME_VISIBLE_ENTRY_VIDEO_INITIAL_LIMIT: number = 36
const HOME_VISIBLE_ENTRY_DEFAULT_LOAD_MORE_STEP: number = 12
const HOME_VISIBLE_ENTRY_PICTURE_LOAD_MORE_STEP: number = 4
const HOME_VISIBLE_ENTRY_VIDEO_LOAD_MORE_STEP: number = 24
const HOME_VISIBLE_ENTRY_ARTICLE_REVEAL_STEP: number = 8
const HOME_VISIBLE_ENTRY_PICTURE_REVEAL_STEP: number = 4
const HOME_VISIBLE_ENTRY_VIDEO_REVEAL_STEP: number = 24

interface HomeVisibleEntryPreloadPolicy {
  preloadRemainingCount: number
  estimatedItemHeight: number
  estimatedVisibleItemCount: number
}

// 首页加载更多沿用“分类精选”列表的窗口预加载规则：
// 当滚动越过「当前可见窗口 - 预留尾部 - 估算视口」时，仅排队加载下一页。
// totalCount 是当前已取回的候选条数，不代表数据库总量，所以不能用
// visibleCount >= totalCount 阻断预取，否则首屏候选耗尽前只能等真正触底。
const HOME_VISIBLE_ENTRY_ARTICLE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 3,
    estimatedItemHeight: 280,
    estimatedVisibleItemCount: 3,
  }

// 社交流已有体感较稳：保留更靠后的触发点和 20 条步进。
const HOME_VISIBLE_ENTRY_SOCIAL_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 1,
    estimatedItemHeight: 380,
    estimatedVisibleItemCount: 2,
  }

// 图片是单列大卡，单页数量提高到 8 条，但触发仍提前保留数张卡的缓冲。
const HOME_VISIBLE_ENTRY_PICTURE_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy =
  {
    preloadRemainingCount: 4,
    estimatedItemHeight: 680,
    estimatedVisibleItemCount: 2,
  }

// 视频是双列网格：每行高度 ≈ 16:9 封面 (~95px) + 8 间距 + 36 标题 + 4 间距
// + 16 元数据 + 12 行间距 ≈ 171px，按"每个 entry 对应半行滚动距离"换算
// 单 entry 等效高度 ≈ 88。preloadRemainingCount 收紧到 8（约 4 行）以便在
// 用户滚到末段时尽早触发，estimatedVisibleItemCount 提到 6（大屏可同时显示
// 3 行 = 6 个 entry）以匹配真实视口。
const HOME_VISIBLE_ENTRY_VIDEO_PRELOAD_POLICY: HomeVisibleEntryPreloadPolicy = {
  preloadRemainingCount: 8,
  estimatedItemHeight: 88,
  estimatedVisibleItemCount: 6,
}

export function resolveHomeVisibleEntryInitialLimit(
  mode: HomeVisibleEntryMode,
): number {
  if (mode === 'videos') {
    return HOME_VISIBLE_ENTRY_VIDEO_INITIAL_LIMIT
  }
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

export function resolveHomeVisibleEntryRevealStep(
  mode?: HomeVisibleEntryMode,
): number {
  if (mode === 'articles') {
    return HOME_VISIBLE_ENTRY_ARTICLE_REVEAL_STEP
  }
  if (mode === 'pictures') {
    return HOME_VISIBLE_ENTRY_PICTURE_REVEAL_STEP
  }
  if (mode === 'videos') {
    return HOME_VISIBLE_ENTRY_VIDEO_REVEAL_STEP
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
  if (visibleCount <= 0 || totalCount <= 0 || currentScrollOffset <= 0) {
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

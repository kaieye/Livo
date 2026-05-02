import { FeedViewType, ViewDefinition } from './LivoTypes'

export function viewDefinitionOf(view: FeedViewType): ViewDefinition {
  switch (view) {
    case FeedViewType.SocialMedia:
      return { id: FeedViewType.SocialMedia, label: '社交', badgeColor: '#DBEAFE', accentColor: '#2563EB' }
    case FeedViewType.Videos:
      return { id: FeedViewType.Videos, label: '视频', badgeColor: '#FEE2E2', accentColor: '#DC2626' }
    case FeedViewType.Pictures:
      return { id: FeedViewType.Pictures, label: '图片', badgeColor: '#FCE7F3', accentColor: '#DB2777' }
    default:
      return { id: FeedViewType.Articles, label: '文章', badgeColor: '#DCFCE7', accentColor: '#16A34A' }
  }
}

export function formatPublishedAt(timestamp: number): string {
  const target = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const hours = target.getHours().toString().padStart(2, '0')
  const minutes = target.getMinutes().toString().padStart(2, '0')
  const sameYear = target.getFullYear() === now.getFullYear()

  if (
    sameYear &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  ) {
    return `今天 ${hours}:${minutes}`
  }

  if (
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${hours}:${minutes}`
  }

  return `${sameYear ? '' : `${target.getFullYear()}年`}${target.getMonth() + 1}月${target.getDate()}日 ${hours}:${minutes}`
}

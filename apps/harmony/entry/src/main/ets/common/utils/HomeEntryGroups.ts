export interface HomeEntryGroupItem {
  viewLabel: string
}

export interface HomeEntryGroups<T extends HomeEntryGroupItem> {
  articles: T[]
  social: T[]
  pictures: T[]
  videos: T[]
}

export function createEmptyHomeEntryGroups<
  T extends HomeEntryGroupItem,
>(): HomeEntryGroups<T> {
  return {
    articles: [],
    social: [],
    pictures: [],
    videos: [],
  }
}

export function groupHomeEntriesByMode<T extends HomeEntryGroupItem>(
  entries: T[],
): HomeEntryGroups<T> {
  const groups = createEmptyHomeEntryGroups<T>()

  entries.forEach((entry: T) => {
    switch (entry.viewLabel) {
      case '文章':
        groups.articles.push(entry)
        break
      case '社交':
        groups.social.push(entry)
        break
      case '图片':
        groups.pictures.push(entry)
        break
      case '视频':
        groups.videos.push(entry)
        break
      default:
        break
    }
  })

  return groups
}

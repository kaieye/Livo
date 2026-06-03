import type { Entry } from '../../../shared/types'
import { FeedViewType } from '../../../shared/types'
import { groupEntriesByDate, type DateGroup } from './date-groups'
import { collapseCoverOnlyBeforeVideoEntries } from './entry-media-decision'

export type EntryListSocialRow =
  | {
      key: string
      type: 'header'
      labelKey: string
      label: string
    }
  | {
      key: string
      type: 'entry'
      entry: Entry
      entryIndex: number
    }

export interface EntryListDerivedModel {
  renderEntries: Entry[]
  entryIndexById: Map<string, number>
  groupedRenderEntries: DateGroup[]
  useVirtualSocialList: boolean
  socialRows: EntryListSocialRow[]
  useVirtualLinearList: boolean
  virtualizerEntries: Entry[]
  gridEntries: Entry[]
  gridRows: Entry[][]
  hasMoreGridEntries: boolean
}

export function buildEntryListDerivedModel(input: {
  baseRenderEntries: Entry[]
  activeView: FeedViewType | null
  groupByDate: boolean
  isGridMode: boolean
  gridVisibleCount: number
}): EntryListDerivedModel {
  const renderEntries =
    input.activeView === FeedViewType.SocialMedia
      ? collapseCoverOnlyBeforeVideoEntries(input.baseRenderEntries)
      : input.baseRenderEntries
  const entryIndexById = new Map(
    renderEntries.map((entry, index) => [entry.id, index] as const),
  )
  const groupedRenderEntries = input.groupByDate
    ? groupEntriesByDate(renderEntries)
    : []
  const useVirtualSocialList = input.activeView === FeedViewType.SocialMedia
  const socialRows = buildSocialRows({
    renderEntries,
    entryIndexById,
    groupedRenderEntries,
    groupByDate: input.groupByDate,
    useVirtualSocialList,
  })
  const useVirtualLinearList =
    !input.isGridMode && input.activeView !== FeedViewType.SocialMedia
  const virtualizerEntries = useVirtualLinearList ? renderEntries : []
  const gridEntries = input.isGridMode
    ? renderEntries.slice(0, input.gridVisibleCount)
    : []
  const gridRows = input.isGridMode ? buildGridRows(gridEntries) : []

  return {
    renderEntries,
    entryIndexById,
    groupedRenderEntries,
    useVirtualSocialList,
    socialRows,
    useVirtualLinearList,
    virtualizerEntries,
    gridEntries,
    gridRows,
    hasMoreGridEntries:
      input.isGridMode && input.gridVisibleCount < renderEntries.length,
  }
}

function buildSocialRows(input: {
  renderEntries: Entry[]
  entryIndexById: Map<string, number>
  groupedRenderEntries: DateGroup[]
  groupByDate: boolean
  useVirtualSocialList: boolean
}): EntryListSocialRow[] {
  if (!input.useVirtualSocialList) return []
  if (input.groupByDate) {
    return input.groupedRenderEntries.flatMap((group) => [
      {
        key: `header:${group.labelKey}:${group.label}`,
        type: 'header' as const,
        labelKey: group.labelKey,
        label: group.label,
      },
      ...group.entries.map((entry) => ({
        key: entry.id,
        type: 'entry' as const,
        entry,
        entryIndex: input.entryIndexById.get(entry.id) ?? 0,
      })),
    ])
  }
  return input.renderEntries.map((entry, index) => ({
    key: entry.id,
    type: 'entry',
    entry,
    entryIndex: index,
  }))
}

function buildGridRows(gridEntries: Entry[]): Entry[][] {
  const rows: Entry[][] = []
  for (let index = 0; index < gridEntries.length; index += 2) {
    rows.push(gridEntries.slice(index, index + 2))
  }
  return rows
}

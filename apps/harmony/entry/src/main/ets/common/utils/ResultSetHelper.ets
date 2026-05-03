import relationalStore from '@ohos.data.relationalStore'

/**
 * Shared ResultSet access helpers — eliminates duplicated defensive column access
 * between FeedRepository and EntryRepository.
 */
export function resultColumnIndex(
  result: relationalStore.ResultSet,
  columnName: string,
): number {
  try {
    return result.getColumnIndex(columnName)
  } catch (_error) {
    return -1
  }
}

export function resultString(
  result: relationalStore.ResultSet,
  columnName: string,
): string {
  try {
    const columnIndex = resultColumnIndex(result, columnName)
    return columnIndex >= 0 ? result.getString(columnIndex) : ''
  } catch (_error) {
    return ''
  }
}

export function resultLong(
  result: relationalStore.ResultSet,
  columnName: string,
): number {
  try {
    const columnIndex = resultColumnIndex(result, columnName)
    return columnIndex >= 0 ? result.getLong(columnIndex) : 0
  } catch (_error) {
    return 0
  }
}

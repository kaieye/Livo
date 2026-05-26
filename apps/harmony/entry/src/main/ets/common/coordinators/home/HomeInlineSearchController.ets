import { RootTabId } from '../../navigation/AppRouter'
import { EntryCardModel } from '../../models/LivoModels'
import { HOME_INLINE_SEARCH_RESULT_LIMIT } from '../../config/HomeRootConfig'
import { HOME_INLINE_SEARCH_INPUT_ID, HOME_INLINE_SEARCH_MOTION_DURATION } from '../../components/HomeInlineSearchOverlay'
import { filterSearchResults, searchResultSummaryText } from './HomeSearchHelper'
import { normalizeInlineSearchQuery } from './HomeInlineSearch'

const HOME_INLINE_SEARCH_FOCUS_DELAYS_MS: number[] = [24, 80, 180, 320]

export interface HomeInlineSearchState {
  searchQuery: string
  showSearch: boolean
  searchOverlayVisible: boolean
  homeInlineSearchFocusRequestToken: number
}

export interface HomeInlineSearchActions {
  currentRootTabId(): RootTabId
  currentSearchEntries(): EntryCardModel[]
  getSearchInputController(): TextInputController
  runManagedTimeout(callback: () => void, delayMs: number): void
}

export class HomeInlineSearchController {
  private readonly state: HomeInlineSearchState
  private readonly actions: HomeInlineSearchActions

  constructor(state: HomeInlineSearchState, actions: HomeInlineSearchActions) {
    this.state = state
    this.actions = actions
  }

  normalizedQuery(): string {
    return normalizeInlineSearchQuery(this.state.searchQuery)
  }

  hasSearchMatches(): boolean {
    return this.searchResultEntries().length > 0
  }

  searchResultEntries(): EntryCardModel[] {
    return filterSearchResults(
      this.actions.currentSearchEntries(),
      this.normalizedQuery(),
      HOME_INLINE_SEARCH_RESULT_LIMIT,
    )
  }

  hasSearchResultEmptyState(): boolean {
    return !!this.normalizedQuery() && this.searchResultEntries().length === 0
  }

  searchResultSummaryText(entry: EntryCardModel): string {
    return searchResultSummaryText(entry, this.normalizedQuery())
  }

  logFocusDebug(event: string, detail: string = ''): void {
    const suffix = detail ? ` ${detail}` : ''
    console.info(
      `[HomeSearchFocusDebug] ${event}${suffix} tab=${this.actions.currentRootTabId()} `
      + `overlay=${this.state.searchOverlayVisible} visible=${this.state.showSearch} `
      + `token=${this.state.homeInlineSearchFocusRequestToken}`,
    )
  }

  open(): void {
    this.logFocusDebug('open-search')
    if (!this.state.searchOverlayVisible) {
      this.state.searchOverlayVisible = true
      this.actions.runManagedTimeout(() => {
        this.state.showSearch = true
        this.logFocusDebug('show-search-overlay')
        this.focus()
      }, 16)
      return
    }

    this.state.showSearch = true
    this.focus()
  }

  focus(): void {
    const requestToken = this.state.homeInlineSearchFocusRequestToken + 1
    this.state.homeInlineSearchFocusRequestToken = requestToken
    this.logFocusDebug('schedule-focus-batch', `requestToken=${requestToken}`)
    HOME_INLINE_SEARCH_FOCUS_DELAYS_MS.forEach((delayMs: number) => {
      this.requestFocus(delayMs, requestToken)
    })
  }

  cancelFocusRequests(reason: string = 'unknown'): void {
    this.state.homeInlineSearchFocusRequestToken = this.state.homeInlineSearchFocusRequestToken + 1
    this.logFocusDebug('cancel-focus-requests', `reason=${reason}`)
  }

  close(clearQuery: boolean = true): void {
    this.cancelFocusRequests('close-search')
    this.state.showSearch = false
    this.actions.getSearchInputController().stopEditing()
    this.logFocusDebug('close-search', `clearQuery=${clearQuery ? 'true' : 'false'}`)
    if (clearQuery) {
      this.state.searchQuery = ''
    }
    this.actions.runManagedTimeout(() => {
      this.finalizeClose()
    }, HOME_INLINE_SEARCH_MOTION_DURATION)
  }

  private requestFocus(delayMs: number, requestToken: number): void {
    this.actions.runManagedTimeout(() => {
      if (!this.canFocus(requestToken)) {
        this.logFocusDebug('skip-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
        return
      }

      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.actions.getSearchInputController().caretPosition(this.state.searchQuery.length)
      this.logFocusDebug('apply-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
    }, delayMs)
  }

  private canFocus(requestToken: number): boolean {
    return requestToken === this.state.homeInlineSearchFocusRequestToken
      && this.actions.currentRootTabId() === 'home'
      && this.state.searchOverlayVisible
      && this.state.showSearch
  }

  private finalizeClose(): void {
    if (this.state.showSearch) {
      return
    }
    this.state.searchOverlayVisible = false
  }
}

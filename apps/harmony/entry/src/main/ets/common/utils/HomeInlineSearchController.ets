import { RootTabId } from '../navigation/AppRouter'
import { EntryCardModel } from '../models/LivoModels'
import { HOME_INLINE_SEARCH_INPUT_ID, HOME_INLINE_SEARCH_MOTION_DURATION } from '../components/HomeInlineSearchOverlay'
import { filterSearchResults, searchResultSummaryText } from './HomeSearchHelper'
import { normalizeInlineSearchQuery } from './HomeInlineSearch'

const HOME_INLINE_SEARCH_FOCUS_DELAYS_MS: number[] = [24, 80, 180, 320]

export interface HomeInlineSearchDelegate {
  getCurrentRootTabId(): RootTabId
  getSearchQuery(): string
  setSearchQuery(query: string): void
  getShowSearch(): boolean
  setShowSearch(visible: boolean): void
  getSearchOverlayVisible(): boolean
  setSearchOverlayVisible(visible: boolean): void
  getSearchFocusRequestToken(): number
  setSearchFocusRequestToken(token: number): void
  getSearchEntries(): EntryCardModel[]
  getSearchResultLimit(): number
  getSearchInputController(): TextInputController
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class HomeInlineSearchController {
  private readonly delegate: HomeInlineSearchDelegate

  constructor(delegate: HomeInlineSearchDelegate) {
    this.delegate = delegate
  }

  normalizedQuery(): string {
    return normalizeInlineSearchQuery(this.delegate.getSearchQuery())
  }

  hasSearchMatches(): boolean {
    return this.searchResultEntries().length > 0
  }

  searchResultEntries(): EntryCardModel[] {
    return filterSearchResults(
      this.delegate.getSearchEntries(),
      this.normalizedQuery(),
      this.delegate.getSearchResultLimit(),
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
      `[HomeSearchFocusDebug] ${event}${suffix} tab=${this.delegate.getCurrentRootTabId()} `
      + `overlay=${this.delegate.getSearchOverlayVisible()} visible=${this.delegate.getShowSearch()} `
      + `token=${this.delegate.getSearchFocusRequestToken()}`,
    )
  }

  open(): void {
    this.logFocusDebug('open-search')
    if (!this.delegate.getSearchOverlayVisible()) {
      this.delegate.setSearchOverlayVisible(true)
      this.delegate.runManagedTimeout(() => {
        this.delegate.setShowSearch(true)
        this.logFocusDebug('show-search-overlay')
        this.focus()
      }, 16)
      return
    }

    this.delegate.setShowSearch(true)
    this.focus()
  }

  focus(): void {
    const requestToken = this.delegate.getSearchFocusRequestToken() + 1
    this.delegate.setSearchFocusRequestToken(requestToken)
    this.logFocusDebug('schedule-focus-batch', `requestToken=${requestToken}`)
    HOME_INLINE_SEARCH_FOCUS_DELAYS_MS.forEach((delayMs: number) => {
      this.requestFocus(delayMs, requestToken)
    })
  }

  cancelFocusRequests(reason: string = 'unknown'): void {
    this.delegate.setSearchFocusRequestToken(this.delegate.getSearchFocusRequestToken() + 1)
    this.logFocusDebug('cancel-focus-requests', `reason=${reason}`)
  }

  close(clearQuery: boolean = true): void {
    this.cancelFocusRequests('close-search')
    this.delegate.setShowSearch(false)
    this.delegate.getSearchInputController().stopEditing()
    this.logFocusDebug('close-search', `clearQuery=${clearQuery ? 'true' : 'false'}`)
    if (clearQuery) {
      this.delegate.setSearchQuery('')
    }
    this.delegate.runManagedTimeout(() => {
      this.finalizeClose()
    }, HOME_INLINE_SEARCH_MOTION_DURATION)
  }

  private requestFocus(delayMs: number, requestToken: number): void {
    this.delegate.runManagedTimeout(() => {
      if (!this.canFocus(requestToken)) {
        this.logFocusDebug('skip-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
        return
      }

      focusControl.requestFocus(HOME_INLINE_SEARCH_INPUT_ID)
      this.delegate.getSearchInputController().caretPosition(this.delegate.getSearchQuery().length)
      this.logFocusDebug('apply-focus-request', `delayMs=${delayMs} requestToken=${requestToken}`)
    }, delayMs)
  }

  private canFocus(requestToken: number): boolean {
    return requestToken === this.delegate.getSearchFocusRequestToken()
      && this.delegate.getCurrentRootTabId() === 'home'
      && this.delegate.getSearchOverlayVisible()
      && this.delegate.getShowSearch()
  }

  private finalizeClose(): void {
    if (this.delegate.getShowSearch()) {
      return
    }

    this.delegate.setSearchOverlayVisible(false)
  }
}

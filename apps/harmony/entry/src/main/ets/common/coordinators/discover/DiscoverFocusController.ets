const DISCOVER_SEARCH_INPUT_ID: string = 'discover-search-input'
const FOCUS_GUARD_DELAYS_MS: readonly number[] = [80, 220, 420]
const FOCUS_REQUEST_DELAY_MS: number = 16
const HIDE_PLATFORM_CHIPS_DELAY_MS: number = 80

export interface DiscoverFocusOwner {
  query: string
  showPlatformChips: boolean
  isInteractingWithPlatformChips: boolean
  keepPlatformChipsOnBlur: boolean
  overlayLevel: number
  searchFocusGuardToken: number
  searchInputFocusable: boolean
  searchInputHasFocus: boolean
  searchInputUserFocusArmed: boolean
  searchInputController: TextInputController
}

export class DiscoverFocusController {
  private readonly owner: DiscoverFocusOwner

  constructor(owner: DiscoverFocusOwner) {
    this.owner = owner
  }

  private logDebug(event: string, detail: string = ''): void {
    const suffix = detail ? ` ${detail}` : ''
    console.info(
      `[DiscoverFocusDebug] ${event}${suffix} overlay=${this.owner.overlayLevel} chips=${this.owner.showPlatformChips} queryLength=${this.owner.query.length} token=${this.owner.searchFocusGuardToken}`,
    )
  }

  armInputFocus(source: string): void {
    if (this.owner.searchInputHasFocus) {
      return
    }
    this.owner.searchInputUserFocusArmed = true
    this.owner.searchInputFocusable = true
    this.logDebug('arm-search-input-focus', `source=${source}`)
    this.requestInputFocus(`arm-${source}`)
  }

  disarmInputFocus(reason: string): void {
    if (!this.owner.searchInputUserFocusArmed && !this.owner.searchInputFocusable) {
      return
    }
    this.owner.searchInputUserFocusArmed = false
    this.owner.searchInputFocusable = false
    this.logDebug('disarm-search-input-focus', `reason=${reason}`)
  }

  private requestInputFocus(source: string): void {
    const guardToken = this.owner.searchFocusGuardToken
    setTimeout(() => {
      if (this.owner.searchFocusGuardToken !== guardToken) {
        this.logDebug('skip-search-input-focus-request', `source=${source} reason=guard-changed`)
        return
      }
      if (!this.owner.searchInputUserFocusArmed || !this.owner.searchInputFocusable) {
        this.logDebug('skip-search-input-focus-request', `source=${source} reason=not-armed`)
        return
      }
      focusControl.requestFocus(DISCOVER_SEARCH_INPUT_ID)
      if (!this.owner.searchInputHasFocus) {
        this.owner.searchInputController.caretPosition(this.owner.query.length)
      }
      this.logDebug('apply-search-input-focus-request', `source=${source}`)
    }, FOCUS_REQUEST_DELAY_MS)
  }

  // Search input UI events.

  onInputTouchDown(): void {
    if (!this.owner.searchInputHasFocus) {
      this.armInputFocus('input-touch-down')
    }
  }

  onInputClick(): void {
    this.logDebug('search-input-click')
    if (!this.owner.searchInputHasFocus) {
      this.armInputFocus('input-click')
    }
    this.owner.showPlatformChips = true
  }

  onInputFocus(): void {
    this.owner.searchInputHasFocus = true
    this.logDebug(
      'search-input-focus',
      `armed=${this.owner.searchInputUserFocusArmed ? 'true' : 'false'} focusable=${this.owner.searchInputFocusable ? 'true' : 'false'}`,
    )
    this.owner.showPlatformChips = true
  }

  onInputBlur(): void {
    this.owner.searchInputHasFocus = false
    this.logDebug('search-input-blur', `keepChips=${this.owner.keepPlatformChipsOnBlur ? 'true' : 'false'}`)
    this.disarmInputFocus('input-blur')
    if (this.owner.keepPlatformChipsOnBlur) {
      this.owner.keepPlatformChipsOnBlur = false
      return
    }
    setTimeout(() => {
      if (!this.owner.isInteractingWithPlatformChips) {
        this.owner.showPlatformChips = false
        this.logDebug('hide-platform-chips-on-blur')
      }
    }, HIDE_PLATFORM_CHIPS_DELAY_MS)
  }

  onChipTouch(isDown: boolean): void {
    this.owner.isInteractingWithPlatformChips = isDown
  }

  // Dismissal & guards. The guard pattern fires multiple delayed dismissals to
  // counter focus restoration races on first-render and overlay return.

  handleSearchDismissSignal(): void {
    this.preventAutoKeyboardPopup('dismiss-signal')
  }

  preventAutoKeyboardPopup(source: string = 'unknown'): void {
    this.owner.searchFocusGuardToken += 1
    const guardToken = this.owner.searchFocusGuardToken
    this.logDebug('prevent-auto-keyboard-popup', `source=${source} guardToken=${guardToken}`)
    this.dismissSearchFocus('guard-initial')
    FOCUS_GUARD_DELAYS_MS.forEach((delayMs: number) => {
      setTimeout(() => {
        if (this.owner.searchFocusGuardToken === guardToken) {
          this.logDebug('guard-dismiss', `delayMs=${delayMs}`)
          this.dismissSearchFocus(`guard-${delayMs}ms`)
        }
      }, delayMs)
    })
  }

  dismissSearchFocus(reason: string = 'unknown'): void {
    this.logDebug('dismiss-search-focus', `reason=${reason}`)
    this.disarmInputFocus(`dismiss-${reason}`)
    this.owner.searchInputController.stopEditing()
    this.owner.searchInputHasFocus = false
    this.owner.showPlatformChips = false
    this.owner.keepPlatformChipsOnBlur = false
  }
}

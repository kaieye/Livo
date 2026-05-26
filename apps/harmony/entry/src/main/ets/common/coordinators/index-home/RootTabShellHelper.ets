import { openRootTab, RootTabId } from '../../navigation/AppRouter'

export function handleRootTabShellAppear(tabId: RootTabId): void {
  void openRootTab(tabId, true)
}

export function shouldRunImmediateHomeTabReload(
  flushedDeferredReload: boolean,
  hasLoadedInitialData: boolean,
  isRefreshing: boolean,
  isHomeStartupRefreshing: boolean,
  hasPendingPostRefreshReload: boolean,
): boolean {
  return hasLoadedInitialData
    && !isRefreshing
    && !isHomeStartupRefreshing
    && !flushedDeferredReload
    && !hasPendingPostRefreshReload
}

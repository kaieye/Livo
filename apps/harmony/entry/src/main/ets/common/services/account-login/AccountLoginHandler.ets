import webview from '@ohos.web.webview'
import type { AccountProvider } from '../../models/LivoModels.ets'

export interface AccountLoginShellState {
  setLoading(value: boolean): void
  setLoadError(value: string): void
  completeAndClose(displayName: string): void
}

export interface AccountLoginHandler {
  readonly provider: AccountProvider

  aboutToAppear(controller: webview.WebviewController, shell: AccountLoginShellState): void
  aboutToDisappear(): void
  onPageBegin(url: string): void
  onPageEnd(url: string): void
  onErrorReceive(error: string, isMainFrame: boolean): void
}

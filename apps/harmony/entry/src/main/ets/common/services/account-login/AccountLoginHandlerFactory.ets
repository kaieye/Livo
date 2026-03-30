import webview from '@ohos.web.webview'
import type { AccountProvider } from '../../models/LivoModels.ets'
import type { AccountLoginHandler, AccountLoginShellState } from './AccountLoginHandler.ets'

class PassiveAccountLoginHandler implements AccountLoginHandler {
  readonly provider: AccountProvider

  constructor(provider: AccountProvider) {
    this.provider = provider
  }

  aboutToAppear(_controller: webview.WebviewController, _shell: AccountLoginShellState): void {}

  aboutToDisappear(): void {}

  onPageBegin(_url: string): void {}

  onPageEnd(_url: string): void {}

  onErrorReceive(_error: string, _isMainFrame: boolean): void {}
}

export function createAccountLoginHandler(provider: AccountProvider): AccountLoginHandler {
  return new PassiveAccountLoginHandler(provider)
}

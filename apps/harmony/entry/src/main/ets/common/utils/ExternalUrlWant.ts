export interface ExternalUrlWant {
  action: string
  uri: string
}

export function buildExternalUrlWant(url: string): ExternalUrlWant {
  return {
    action: 'ohos.want.action.viewData',
    uri: (url || '').trim(),
  }
}

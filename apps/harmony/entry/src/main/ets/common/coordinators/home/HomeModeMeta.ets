export type HomeMode = 'articles' | 'social' | 'pictures' | 'videos'

export const HOME_MODES: HomeMode[] = ['articles', 'social', 'pictures', 'videos']

export function resolveHomeModeTitle(mode: HomeMode): string {
  switch (mode) {
    case 'articles':
      return '文章'
    case 'social':
      return '社交'
    case 'pictures':
      return '图片'
    case 'videos':
      return '视频'
    default:
      return ''
  }
}

export function resolveHomeModeSymbol(mode: HomeMode): Resource {
  switch (mode) {
    case 'articles':
      return $r('sys.symbol.doc_text')
    case 'social':
      return $r('sys.symbol.ellipsis_bubble')
    case 'pictures':
      return $r('sys.symbol.picture_2')
    case 'videos':
    default:
      return $r('sys.symbol.media_center')
  }
}

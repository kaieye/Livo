export type SettingsSheetKey =
  | ''
  | 'appearance'
  | 'general'
  | 'refresh-log'
  | 'privacy'
  | 'about'
  | 'favorites'
  | 'accounts'
  | 'ai-assistant'
  | 'subscriptions'

export interface SettingItem {
  title: string
  symbol: Resource
  symbolIsImage?: boolean
  symbolColor: string
  subtitle: string
  hint?: string
  sheet: SettingsSheetKey
  sheetHeight: number
}

const SHEET_MIN_HEIGHT: number = 420
const SHEET_COMPACT_HEIGHT: number = 440
const SHEET_STANDARD_HEIGHT: number = 500
const SHEET_TALL_HEIGHT: number = 600

export const SETTINGS_PRIMARY_GROUP: SettingItem[] = [
  {
    title: '通用',
    symbol: $r('sys.symbol.gearshape'),
    symbolColor: '#4F5D75',
    subtitle: '语言、刷新与基础偏好',
    sheet: 'general',
    sheetHeight: 450,
  },
  {
    title: '外观',
    symbol: $r('sys.symbol.brush_fill'),
    symbolColor: '#6C63FF',
    subtitle: '主题、字号与阅读观感',
    sheet: 'appearance',
    sheetHeight: SHEET_TALL_HEIGHT,
  },
  {
    title: '账户',
    symbol: $r('sys.symbol.person'),
    symbolColor: '#FF8C42',
    subtitle: '账户连接与个人资料',
    sheet: 'accounts',
    sheetHeight: 520,
  },
]

export const SETTINGS_SECOND_GROUP: SettingItem[] = [
  {
    title: '收藏',
    symbol: $r('sys.symbol.star_fill'),
    symbolColor: '#F59E0B',
    subtitle: '查看并管理已收藏的推文与内容',
    sheet: 'favorites',
    sheetHeight: SHEET_TALL_HEIGHT,
  },
  {
    title: 'AI助手',
    symbol: $r('app.media.ri_ai'),
    symbolIsImage: true,
    symbolColor: '#7A5AF8',
    subtitle: '智能摘要与助手能力',
    sheet: 'ai-assistant',
    sheetHeight: SHEET_TALL_HEIGHT,
  },
  {
    title: '列表',
    symbol: $r('sys.symbol.list_bullet_square_fill'),
    symbolColor: '#3B82F6',
    subtitle: '列表密度与内容呈现',
    sheet: '',
    sheetHeight: SHEET_STANDARD_HEIGHT,
  },
]

export const SETTINGS_THIRD_GROUP: SettingItem[] = [
  {
    title: '订阅',
    symbol: $r('sys.symbol.folder_fill'),
    symbolColor: '#FF8A3D',
    subtitle: '订阅源导入、整理与同步',
    sheet: 'subscriptions',
    sheetHeight: 520,
  },
]

export const SETTINGS_FOURTH_GROUP: SettingItem[] = [
  {
    title: '刷新日志',
    symbol: $r('sys.symbol.arrow_clockwise_circle_fill'),
    symbolColor: '#3D7BFF',
    subtitle: '查看每次刷新结果与失败订阅源',
    sheet: 'refresh-log',
    sheetHeight: SHEET_COMPACT_HEIGHT,
  },
  {
    title: '隐私',
    symbol: $r('sys.symbol.person_shield_fill'),
    symbolColor: '#5B6CFF',
    subtitle: '代理、权限与本地隐私',
    sheet: 'privacy',
    sheetHeight: 520,
  },
  {
    title: '关于',
    symbol: $r('sys.symbol.info_circle'),
    symbolColor: '#7B8794',
    subtitle: '版本信息与项目说明',
    sheet: 'about',
    sheetHeight: 460,
  },
]

const ALL_GROUPS: SettingItem[][] = [
  SETTINGS_PRIMARY_GROUP,
  SETTINGS_SECOND_GROUP,
  SETTINGS_THIRD_GROUP,
  SETTINGS_FOURTH_GROUP,
]

export function resolveInitialSheetHeight(activeSheet: SettingsSheetKey): number {
  if (!activeSheet) {
    return Math.max(SHEET_MIN_HEIGHT, SHEET_STANDARD_HEIGHT)
  }
  for (const group of ALL_GROUPS) {
    for (const item of group) {
      if (item.sheet === activeSheet) {
        return Math.max(SHEET_MIN_HEIGHT, item.sheetHeight)
      }
    }
  }
  return Math.max(SHEET_MIN_HEIGHT, SHEET_STANDARD_HEIGHT)
}

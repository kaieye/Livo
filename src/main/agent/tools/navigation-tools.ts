import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  dispatchAgentNavigation,
  type AgentRootTab,
  type AgentSettingsPanel,
} from '../navigation-bridge'
import {
  HTTP_URL_SCHEMES,
  SHORT_TEXT_MAX_LENGTH,
  URL_MAX_LENGTH,
  emptyParams,
  objectParams,
} from './schema'

const ROOT_TABS: AgentRootTab[] = [
  'home',
  'subscriptions',
  'discover',
  'settings',
]
const SETTINGS_PANELS: AgentSettingsPanel[] = [
  'settings',
  'general',
  'appearance',
  'reading',
  'data',
  'privacy',
  'about',
  'ai',
]

const ROOT_TAB_LABELS: Record<AgentRootTab, string> = {
  home: '首页',
  subscriptions: '订阅',
  discover: '发现',
  settings: '设置',
}

const SETTINGS_PANEL_LABELS: Record<AgentSettingsPanel, string> = {
  settings: '设置',
  general: '通用设置',
  appearance: '外观设置',
  reading: '阅读设置',
  data: '数据控制',
  privacy: '隐私设置',
  about: '关于页',
  ai: 'AI 设置',
}

export function buildOpenRootTabTool(): AgentTool {
  return {
    name: 'open_root_tab',
    title: '打开导航标签',
    description: '打开应用的首页、订阅、发现或设置视图',
    inputSchema: objectParams(
      {
        tab: { type: 'string', description: '要打开的视图', enum: ROOT_TABS },
        replace: {
          type: 'boolean',
          description: '是否替换当前视图，默认 true',
        },
      },
      ['tab'],
    ),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const tab = args['tab'] as AgentRootTab
      const replace =
        typeof args['replace'] === 'boolean'
          ? (args['replace'] as boolean)
          : true
      dispatchAgentNavigation({ type: 'open-root-tab', tab, replace })
      return {
        status: 'success',
        message: `已打开${ROOT_TAB_LABELS[tab] ?? tab}`,
        data: { tab, replace },
      }
    },
  }
}

export function buildGoBackTool(): AgentTool {
  return {
    name: 'go_back',
    title: '返回上一页',
    description: '从当前视图返回上一个视图',
    inputSchema: emptyParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      dispatchAgentNavigation({ type: 'go-back' })
      return { status: 'success', message: '已返回上一页' }
    },
  }
}

export function buildOpenEntryDetailTool(): AgentTool {
  return {
    name: 'open_entry_detail',
    title: '打开文章详情',
    description: '根据文章 ID 打开文章详情。通常先通过查询工具获得 entryId',
    inputSchema: objectParams(
      {
        entryId: {
          type: 'string',
          description: '要打开的文章 ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['entryId'],
    ),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const entryId = String(args['entryId']).trim()
      dispatchAgentNavigation({ type: 'open-entry-detail', entryId })
      return {
        status: 'success',
        message: `已打开文章详情：${entryId}`,
        data: { entryId },
      }
    },
  }
}

export function buildOpenFeedDetailTool(): AgentTool {
  return {
    name: 'open_feed_detail',
    title: '打开订阅详情',
    description: '根据订阅源 ID 打开订阅详情。通常先通过查询工具获得 feedId',
    inputSchema: objectParams(
      {
        feedId: {
          type: 'string',
          description: '要打开的订阅源 ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['feedId'],
    ),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const feedId = String(args['feedId']).trim()
      dispatchAgentNavigation({ type: 'open-feed-detail', feedId })
      return {
        status: 'success',
        message: `已打开订阅详情：${feedId}`,
        data: { feedId },
      }
    },
  }
}

export function buildOpenSettingsPanelTool(): AgentTool {
  return {
    name: 'open_settings_panel',
    title: '打开设置面板',
    description:
      '打开设置弹窗中的某个面板，如通用、外观、阅读、数据、隐私、AI、关于、Agent 权限',
    inputSchema: objectParams(
      {
        panel: {
          type: 'string',
          description: '要打开的设置面板',
          enum: SETTINGS_PANELS,
        },
      },
      ['panel'],
    ),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const panel = args['panel'] as AgentSettingsPanel
      dispatchAgentNavigation({ type: 'open-settings-panel', panel })
      return {
        status: 'success',
        message: `已打开${SETTINGS_PANEL_LABELS[panel] ?? panel}`,
        data: { panel },
      }
    },
  }
}

export function buildOpenVideoPlayerTool(): AgentTool {
  return {
    name: 'open_video_player',
    title: '打开视频播放',
    description: '使用指定视频地址打开应用内视频播放',
    inputSchema: objectParams(
      {
        videoUrl: {
          type: 'string',
          description: '视频地址',
          minLength: 1,
          maxLength: URL_MAX_LENGTH,
          format: 'uri',
          allowedSchemes: HTTP_URL_SCHEMES,
        },
        title: {
          type: 'string',
          description: '视频标题，可选',
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        previewUrl: {
          type: 'string',
          description: '视频封面地址，可选',
          maxLength: URL_MAX_LENGTH,
          format: 'uri',
          allowedSchemes: HTTP_URL_SCHEMES,
        },
      },
      ['videoUrl'],
    ),
    capability: 'navigate',
    risk: 'medium',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const videoUrl = String(args['videoUrl']).trim()
      const title = String(args['title'] || '视频播放').trim() || '视频播放'
      const previewUrl = String(args['previewUrl'] || '').trim()
      dispatchAgentNavigation({
        type: 'open-video-player',
        title,
        videoUrl,
        previewUrl,
      })
      return {
        status: 'success',
        message: `已打开视频播放：${title}`,
        data: { title, videoUrl },
      }
    },
  }
}

export function buildOpenImageViewerTool(): AgentTool {
  return {
    name: 'open_image_viewer',
    title: '打开图片预览',
    description: '使用指定图片地址打开应用内图片预览',
    inputSchema: objectParams(
      {
        imageUrl: {
          type: 'string',
          description: '图片地址',
          minLength: 1,
          maxLength: URL_MAX_LENGTH,
          format: 'uri',
          allowedSchemes: HTTP_URL_SCHEMES,
        },
        title: {
          type: 'string',
          description: '图片标题，可选',
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['imageUrl'],
    ),
    capability: 'navigate',
    risk: 'medium',
    requiresConfirmation: false,
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const imageUrl = String(args['imageUrl']).trim()
      const title = String(args['title'] || '图片预览').trim() || '图片预览'
      dispatchAgentNavigation({ type: 'open-image-viewer', imageUrl, title })
      return {
        status: 'success',
        message: `已打开图片预览：${title}`,
        data: { title, imageUrl },
      }
    },
  }
}

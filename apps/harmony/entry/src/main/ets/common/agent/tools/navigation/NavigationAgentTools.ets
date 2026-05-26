import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import type { RootTabId } from '../../../navigation/AppRouter'
import {
  goBack,
  openAboutSettings,
  openAppearanceSettings,
  openArticleDetail,
  openDataControlSettings,
  openFeedDetail,
  openGeneralSettings,
  openImageViewer,
  openPrivacySettings,
  openRootTab,
  openVideoPlayer,
} from '../../../navigation/AppRouter'

type SettingsPanelId = 'settings' | 'general' | 'appearance' | 'data_control' | 'privacy' | 'about'

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function rootTabParams(): AgentToolInputSchema {
  const tabParam: AgentToolParamSchema = {
    type: 'string',
    description: '要打开的根标签',
    enum: ['home', 'subscriptions', 'discover', 'settings'],
  }
  const replaceParam: AgentToolParamSchema = {
    type: 'boolean',
    description: '是否替换当前页面栈，默认 true',
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['tab'] = tabParam
  properties['replace'] = replaceParam
  const required: string[] = ['tab']
  return { type: 'object', properties, required, additionalProperties: false }
}

function entryDetailParams(): AgentToolInputSchema {
  const entryIdParam: AgentToolParamSchema = { type: 'string', description: '要打开的文章 ID' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['entryId'] = entryIdParam
  const required: string[] = ['entryId']
  return { type: 'object', properties, required, additionalProperties: false }
}

function feedDetailParams(): AgentToolInputSchema {
  const feedIdParam: AgentToolParamSchema = { type: 'string', description: '要打开的订阅源 ID' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['feedId'] = feedIdParam
  const required: string[] = ['feedId']
  return { type: 'object', properties, required, additionalProperties: false }
}

function settingsPanelParams(): AgentToolInputSchema {
  const panelParam: AgentToolParamSchema = {
    type: 'string',
    description: '要打开的设置面板',
    enum: ['settings', 'general', 'appearance', 'data_control', 'privacy', 'about'],
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['panel'] = panelParam
  const required: string[] = ['panel']
  return { type: 'object', properties, required, additionalProperties: false }
}

function videoPlayerParams(): AgentToolInputSchema {
  const titleParam: AgentToolParamSchema = { type: 'string', description: '视频标题，可选' }
  const videoUrlParam: AgentToolParamSchema = { type: 'string', description: '视频地址' }
  const previewUrlParam: AgentToolParamSchema = { type: 'string', description: '视频封面地址，可选' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['title'] = titleParam
  properties['videoUrl'] = videoUrlParam
  properties['previewUrl'] = previewUrlParam
  const required: string[] = ['videoUrl']
  return { type: 'object', properties, required, additionalProperties: false }
}

function imageViewerParams(): AgentToolInputSchema {
  const imageUrlParam: AgentToolParamSchema = { type: 'string', description: '图片地址' }
  const titleParam: AgentToolParamSchema = { type: 'string', description: '图片标题，可选' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['imageUrl'] = imageUrlParam
  properties['title'] = titleParam
  const required: string[] = ['imageUrl']
  return { type: 'object', properties, required, additionalProperties: false }
}

function rootTabLabel(tab: RootTabId): string {
  if (tab === 'subscriptions') {
    return '订阅'
  }
  if (tab === 'discover') {
    return '发现'
  }
  if (tab === 'settings') {
    return '设置'
  }
  return '首页'
}

function settingsPanelLabel(panel: SettingsPanelId): string {
  if (panel === 'general') {
    return '通用设置'
  }
  if (panel === 'appearance') {
    return '外观设置'
  }
  if (panel === 'data_control') {
    return '数据控制'
  }
  if (panel === 'privacy') {
    return '隐私设置'
  }
  if (panel === 'about') {
    return '关于页'
  }
  return '设置'
}

async function openSettingsPanel(panel: SettingsPanelId): Promise<void> {
  if (panel === 'general') {
    await openGeneralSettings()
    return
  }
  if (panel === 'appearance') {
    await openAppearanceSettings()
    return
  }
  if (panel === 'data_control') {
    await openDataControlSettings()
    return
  }
  if (panel === 'privacy') {
    await openPrivacySettings()
    return
  }
  if (panel === 'about') {
    await openAboutSettings()
    return
  }
  await openRootTab('settings')
}

export function buildOpenRootTabTool(): AgentTool {
  return {
    name: 'open_root_tab',
    title: '打开根标签',
    description: '打开应用底部导航中的首页、订阅、发现或设置标签',
    inputSchema: rootTabParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const tab = args['tab'] as RootTabId
      const replaceRaw = args['replace'] as boolean
      const replace = typeof replaceRaw === 'boolean' ? replaceRaw : true
      console.info('[NavigationAgent] open_root_tab', tab, 'replace:', replace)
      await openRootTab(tab, replace)
      return {
        status: 'success',
        message: `已打开${rootTabLabel(tab)}标签`,
        data: { tab, replace },
      }
    },
  }
}

export function buildGoBackTool(): AgentTool {
  return {
    name: 'go_back',
    title: '返回上一页',
    description: '从当前页面返回上一页',
    inputSchema: emptyParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      console.info('[NavigationAgent] go_back')
      await goBack()
      return { status: 'success', message: '已返回上一页' }
    },
  }
}

export function buildOpenEntryDetailTool(): AgentTool {
  return {
    name: 'open_entry_detail',
    title: '打开文章详情',
    description: '根据文章 ID 打开文章详情页。通常先通过查询工具获得 entryId，再调用此工具',
    inputSchema: entryDetailParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const entryId = (args['entryId'] as string).trim()
      console.info('[NavigationAgent] open_entry_detail', entryId)
      await openArticleDetail(entryId)
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
    description: '根据订阅源 ID 打开订阅详情页。通常先通过查询工具获得 feedId，再调用此工具',
    inputSchema: feedDetailParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const feedId = (args['feedId'] as string).trim()
      console.info('[NavigationAgent] open_feed_detail', feedId)
      await openFeedDetail(feedId)
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
    description: '打开设置首页或通用、外观、数据控制、隐私、关于等设置面板',
    inputSchema: settingsPanelParams(),
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const panel = args['panel'] as SettingsPanelId
      console.info('[NavigationAgent] open_settings_panel', panel)
      await openSettingsPanel(panel)
      return {
        status: 'success',
        message: `已打开${settingsPanelLabel(panel)}`,
        data: { panel },
      }
    },
  }
}

export function buildOpenVideoPlayerTool(): AgentTool {
  return {
    name: 'open_video_player',
    title: '打开视频播放页',
    description: '使用指定视频地址打开应用内视频播放页',
    inputSchema: videoPlayerParams(),
    capability: 'navigate',
    risk: 'medium',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const videoUrl = (args['videoUrl'] as string).trim()
      const title = ((args['title'] as string) || '视频播放').trim() || '视频播放'
      const previewUrl = ((args['previewUrl'] as string) || '').trim()
      console.info('[NavigationAgent] open_video_player', title)
      await openVideoPlayer(title, videoUrl, previewUrl)
      return {
        status: 'success',
        message: `已打开视频播放页：${title}`,
        data: { title, videoUrl, previewUrl },
      }
    },
  }
}

export function buildOpenImageViewerTool(): AgentTool {
  return {
    name: 'open_image_viewer',
    title: '打开图片预览',
    description: '使用指定图片地址打开应用内图片预览页',
    inputSchema: imageViewerParams(),
    capability: 'navigate',
    risk: 'medium',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const imageUrl = (args['imageUrl'] as string).trim()
      const title = ((args['title'] as string) || '图片预览').trim() || '图片预览'
      console.info('[NavigationAgent] open_image_viewer', title)
      await openImageViewer(imageUrl, title)
      return {
        status: 'success',
        message: `已打开图片预览：${title}`,
        data: { title, imageUrl },
      }
    },
  }
}

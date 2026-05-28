import { zhCNCommon } from './zh-CN/common'
import { zhCNContextMenu } from './zh-CN/context-menu'
import { zhCNDiscover } from './zh-CN/discover'
import { zhCNEntry } from './zh-CN/entry'
import { zhCNErrorBoundary } from './zh-CN/error-boundary'
import { zhCNFeedDetail } from './zh-CN/feed-detail'
import { zhCNArticleDetail } from './zh-CN/article-detail'
import { zhCNImportProgress } from './zh-CN/import-progress'
import { zhCNQuickSearch } from './zh-CN/quick-search'
import { zhCNRecommendations } from './zh-CN/recommendations'
import { zhCNSettings } from './zh-CN/settings'
import { zhCNShortcuts } from './zh-CN/shortcuts'
import { zhCNSidebar } from './zh-CN/sidebar'
import { zhCNVideoPlayer } from './zh-CN/video-player'
import { zhCNImageViewer } from './zh-CN/image-viewer'

export const zhCN = {
  settings: zhCNSettings,
  common: zhCNCommon,

  viewTypes: {
    articles: '文章',
    socialMedia: '推文',
    videos: '视频',
    pictures: '图片',
  },

  entry: zhCNEntry,

  entryList: {
    starred: '收藏',
    all: '全部',
    unread: '未读',
    searchArticles: '搜索文章...',
    noArticles: '暂无文章',
    addFeedToStart: '添加订阅源以开始阅读',
    play: '播放',
    images: '图',
    showMore: '展开更多',
    showLess: '收起',
    today: '今天',
    yesterday: '昨天',
    daysAgo: '{{days}}天前',
    earlier: '更早',
    copyTitle: '复制标题',
    titleCopied: '标题已复制',
    share: '分享',
    shareEntry: '分享文章',
    saveImage: '保存图片',
    imageSaved: '图片已保存',
    exportPDF: '导出 PDF',
    sharePoster: '分享海报',
    posterTitle: '分享海报',
    posterSaving: '正在生成...',
    posterSaved: '海报已保存',
    viewImageGallery: '查看图库 ({{count}})',
    videoPlayer: '视频播放',
    saveToReadwise: '保存到 Readwise',
    saveToInstapaper: '保存到 Instapaper',
    savedSuccessfully: '保存成功',
    saveFailed: '保存失败',
    integrations: '第三方集成',
    integrationsDesc: '将文章保存到第三方服务',
  },

  sidebar: zhCNSidebar,

  aiChat: {
    title: 'AI 助手',
    clearChat: '清空对话',
    currentlyReading: '正在阅读:',
    welcome: 'AI 助手',
    welcomeDesc: '可以询问关于当前文章的问题，或进行任意对话',
    suggestion1: '总结这篇文章的要点',
    suggestion2: '这篇文章的观点有什么问题？',
    suggestion3: '用通俗语言解释这篇文章',
    inputPlaceholder: '输入消息...',
    error: '错误: {{message}}',
  },

  social: {
    translateTweet: '翻译',
    summarizeTweet: 'AI 总结',
    translation: 'AI 翻译',
    aiSummary: 'AI 总结',
  },

  media: {
    rewind10: '后退 10 秒',
    forward10: '前进 10 秒',
    playbackSpeed: '播放速度',
    unmute: '取消静音',
    mute: '静音',
    download: '下载',
    closePlayer: '关闭播放器',
  },

  discover: zhCNDiscover,

  quickSearch: zhCNQuickSearch,

  shortcuts: zhCNShortcuts,

  actionLabels: {
    field_entryTitle: '文章标题',
    field_entryContent: '文章内容',
    field_entryAuthor: '文章作者',
    field_entryUrl: '文章 URL',
    field_feedTitle: '订阅源标题',
    field_feedUrl: '订阅源 URL',
    field_feedCategory: '订阅源分类',
    op_contains: '包含',
    op_notContains: '不包含',
    op_equals: '等于',
    op_notEquals: '不等于',
    op_matchesRegex: '匹配正则',
    op_startsWith: '以…开头',
    op_endsWith: '以…结尾',
    effect_block: '屏蔽 (不添加)',
    effect_star: '自动收藏',
    effect_markRead: '标记已读',
    effect_notify: '桌面通知',
    effect_readability: '自动 Readability',
    effect_summarize: '自动 AI 摘要',
  },

  importProgress: zhCNImportProgress,

  errorBoundary: zhCNErrorBoundary,

  recommendations: zhCNRecommendations,

  contextMenu: zhCNContextMenu,

  feedDetail: zhCNFeedDetail,

  articleDetail: zhCNArticleDetail,

  videoPlayer: zhCNVideoPlayer,

  imageViewer: zhCNImageViewer,

  time: {
    justNow: '刚刚',
    minutesAgo: '{{minutes}}分钟前',
    hoursAgo: '{{hours}}小时前',
    daysAgo: '{{days}}天前',
  },
}

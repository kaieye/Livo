import { enCommon } from './en/common'
import { enContextMenu } from './en/context-menu'
import { enDiscover } from './en/discover'
import { enDiscoverPreview } from './en/discover-preview'
import { enDiscoverSubscribeConfig } from './en/discover-subscribe-config'
import { enEntry } from './en/entry'
import { enErrorBoundary } from './en/error-boundary'
import { enArticleDetail } from './en/article-detail'
import { enImportProgress } from './en/import-progress'
import { enQuickSearch } from './en/quick-search'
import { enRecommendations } from './en/recommendations'
import { enSettings } from './en/settings'
import { enShortcuts } from './en/shortcuts'
import { enSidebar } from './en/sidebar'
import { enVideoPlayer } from './en/video-player'
import { enImageViewer } from './en/image-viewer'
import { enAccountLogin } from './en/account-login'

export const en = {
  settings: enSettings,
  common: enCommon,

  viewTypes: {
    articles: 'Articles',
    socialMedia: 'Social Media',
    videos: 'Videos',
    pictures: 'Pictures',
  },

  entry: enEntry,

  entryList: {
    starred: 'Starred',
    all: 'All',
    unread: 'Unread',
    searchArticles: 'Search articles...',
    inlineSearchEmptyTitle: 'No matches in this view',
    inlineSearchEmptyHint:
      'Try keywords from the title, summary, source or author',
    noArticles: 'No articles',
    addFeedToStart: 'Add a feed to get started',
    play: 'Play',
    images: 'img',
    showMore: 'Show more',
    showLess: 'Show less',
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: '{{days}} days ago',
    earlier: 'Earlier',
    copyTitle: 'Copy Title',
    titleCopied: 'Title copied',
    share: 'Share',
    shareEntry: 'Share Entry',
    saveImage: 'Save Image',
    imageSaved: 'Image saved',
    exportPDF: 'Export PDF',
    sharePoster: 'Share Poster',
    posterTitle: 'Share Poster',
    posterSaving: 'Generating...',
    posterSaved: 'Poster saved',
    viewImageGallery: 'View Gallery ({{count}})',
    videoPlayer: 'Video Player',
    saveToReadwise: 'Save to Readwise',
    saveToInstapaper: 'Save to Instapaper',
    savedSuccessfully: 'Saved successfully',
    saveFailed: 'Save failed',
    integrations: 'Integrations',
    integrationsDesc: 'Save articles to third-party services',
  },

  sidebar: enSidebar,

  aiChat: {
    title: 'AI Assistant',
    clearChat: 'Clear chat',
    currentlyReading: 'Currently reading:',
    welcome: 'AI Assistant',
    welcomeDesc:
      'Ask questions about the current article, or have any conversation',
    suggestion1: 'Extract the core claim and evidence from this article',
    suggestion2: "Find today's updates that are most worth reading first",
    suggestion3: 'Suggest a topic I should follow next based on my feeds',
    inputPlaceholder: 'Type a message...',
    error: 'Error: {{message}}',
    newConversation: 'New conversation',
    history: 'History',
    trace: 'Execution trace',
    stop: 'Stop',
  },

  social: {
    translateTweet: 'Translate',
    summarizeTweet: 'AI Summary',
    translation: 'AI Translation',
    aiSummary: 'AI Summary',
  },

  media: {
    rewind10: 'Rewind 10s',
    forward10: 'Forward 10s',
    playbackSpeed: 'Playback speed',
    unmute: 'Unmute',
    mute: 'Mute',
    download: 'Download',
    closePlayer: 'Close player',
    previousTrack: 'Previous track',
    nextTrack: 'Next track',
  },

  discover: enDiscover,
  discoverPreview: enDiscoverPreview,
  discoverSubscribeConfig: enDiscoverSubscribeConfig,

  quickSearch: enQuickSearch,

  shortcuts: enShortcuts,

  actionLabels: {
    field_entryTitle: 'Article Title',
    field_entryContent: 'Article Content',
    field_entryAuthor: 'Article Author',
    field_entryUrl: 'Article URL',
    field_feedTitle: 'Feed Title',
    field_feedUrl: 'Feed URL',
    field_feedCategory: 'Feed Category',
    field_ai_semantic: 'AI Semantic',
    op_contains: 'Contains',
    op_notContains: 'Not Contains',
    op_equals: 'Equals',
    op_notEquals: 'Not Equals',
    op_matchesRegex: 'Matches Regex',
    op_startsWith: 'Starts With',
    op_endsWith: 'Ends With',
    op_semantic_matches: 'Semantic Match',
    effect_block: "Block (don't add)",
    effect_star: 'Auto Star',
    effect_markRead: 'Mark Read',
    effect_notify: 'Desktop Notification',
    effect_readability: 'Auto Readability',
    effect_summarize: 'Auto AI Summary',
  },

  importProgress: enImportProgress,

  errorBoundary: enErrorBoundary,

  recommendations: enRecommendations,

  contextMenu: enContextMenu,

  articleDetail: enArticleDetail,

  videoPlayer: enVideoPlayer,

  imageViewer: enImageViewer,

  accountLogin: enAccountLogin,

  time: {
    justNow: 'Just Now',
    minutesAgo: '{{minutes}}m ago',
    hoursAgo: '{{hours}}h ago',
    daysAgo: '{{days}}d ago',
  },
}

import { DEFAULT_HARMONY_SETTINGS, FeedViewType, toArticleDetailModel, toEntryCardModel, toFeedCardModel, } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { ArticleDetailModel, DashboardMetric, Entry, EntryCardModel, Feed, FeedCardModel, FeedWithCount, HarmonySettings, RemoteFeedResult } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { AppPreferenceService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppPreferenceService";
import { RssFeedService } from "@bundle:com.livo.harmony/entry/ets/common/services/RssFeedService";
const FEEDS: Feed[] = [
    {
        id: 'feed-tech',
        title: 'Tech Pulse',
        url: 'https://example.com/feeds/tech.xml',
        siteUrl: 'https://example.com/tech',
        description: '聚合产品、工程与 AI 动态，适合作为 Livo 首页主干信息流。',
        category: '科技',
        view: FeedViewType.Articles,
        showInAll: true,
        lastFetched: Date.now() - 15 * 60 * 1000,
        errorCount: 0,
        createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    },
    {
        id: 'feed-design',
        title: 'Design Notes',
        url: 'https://example.com/feeds/design.xml',
        siteUrl: 'https://example.com/design',
        description: '交互设计、界面灵感与视觉趋势，适合作为图片流和收藏流入口。',
        category: '设计',
        view: FeedViewType.Pictures,
        showInAll: true,
        lastFetched: Date.now() - 32 * 60 * 1000,
        errorCount: 0,
        createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000,
    },
    {
        id: 'feed-social',
        title: 'Creator Stream',
        url: 'https://example.com/feeds/social.xml',
        siteUrl: 'https://example.com/social',
        description: '创作者动态与短内容流，后续可对接账号订阅和推荐流。',
        category: '社交',
        view: FeedViewType.SocialMedia,
        showInAll: true,
        lastFetched: Date.now() - 8 * 60 * 1000,
        errorCount: 0,
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    },
    {
        id: 'feed-video',
        title: 'Dev Weekly',
        url: 'https://example.com/feeds/video.xml',
        siteUrl: 'https://example.com/video',
        description: '视频播客与技术周报，适合承接未来的视频与播客阅读体验。',
        category: '视频',
        view: FeedViewType.Videos,
        showInAll: false,
        lastFetched: Date.now() - 60 * 60 * 1000,
        errorCount: 1,
        createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    },
];
const ENTRIES: Entry[] = [
    {
        id: 'entry-1',
        feedId: 'feed-tech',
        title: '如何把桌面端 RSS 阅读体验迁移到鸿蒙',
        url: 'https://example.com/tech/harmony-migration',
        summary: '从能力拆分、状态管理到本地存储策略，梳理多端迁移时最容易踩坑的边界。',
        content: '从桌面端迁移到 HarmonyOS，第一步不是搬页面，而是先分清共享模型、平台能力和展示层边界。\n\nLivo 在桌面端已经形成了 feed、entry、settings 这样的核心模型，鸿蒙端可以先把这些模型映射成 ArkTS 可落地的数据结构，再逐步接入网络和存储。\n\n这样处理之后，首页、订阅页、详情页都能围绕同一套领域对象演进，后续替换 mock 数据时不会推倒重来。',
        author: 'Livo Lab',
        publishedAt: Date.now() - 3 * 60 * 60 * 1000,
        readingTimeMinutes: 6,
        tags: ['ArkTS', '架构', '多端'],
        isRead: false,
        isStarred: true,
        createdAt: Date.now() - 3 * 60 * 60 * 1000,
    },
    {
        id: 'entry-2',
        feedId: 'feed-design',
        title: '信息流卡片在小屏设备上的层级优化',
        url: 'https://example.com/design/card-hierarchy',
        summary: '用更轻的视觉密度保留更高的信息吞吐，适合阅读类产品首页。',
        content: '阅读类产品在手机和平板上都需要面对有限空间，因此卡片层级必须更克制。\n\n一张卡片里最好只保留标题、摘要、来源和一个最关键的状态，过多操作会让阅读主线被打断。\n\n鸿蒙端首页适合先把推荐内容做成轻量卡片，再在详情页承接完整动作。',
        author: 'Design Hub',
        publishedAt: Date.now() - 5 * 60 * 60 * 1000,
        readingTimeMinutes: 4,
        tags: ['设计', '卡片', '阅读'],
        isRead: false,
        isStarred: false,
        createdAt: Date.now() - 5 * 60 * 60 * 1000,
    },
    {
        id: 'entry-3',
        feedId: 'feed-social',
        title: '订阅源聚合里推荐算法最小可用版本',
        url: 'https://example.com/social/recommendation-mvp',
        summary: '从用户显式订阅和最近阅读行为出发，构造一个无需复杂训练的数据驱动推荐流。',
        content: '推荐流不一定要从复杂模型开始，订阅源聚合应用更适合先做一个可解释的 MVP。\n\n比如根据最近阅读主题、未读优先级和用户显式收藏行为，就能得到一条可用的推荐结果。\n\n这种方式很适合作为 Livo 鸿蒙端首页的推荐区第一版。',
        author: 'Creator Stream',
        publishedAt: Date.now() - 16 * 60 * 60 * 1000,
        readingTimeMinutes: 5,
        tags: ['推荐', '社交', '产品'],
        isRead: true,
        isStarred: false,
        createdAt: Date.now() - 16 * 60 * 60 * 1000,
    },
    {
        id: 'entry-4',
        feedId: 'feed-video',
        title: '用鸿蒙原生页面搭建沉浸式播客列表',
        url: 'https://example.com/video/podcast-layout',
        summary: '将视频与音频订阅整合进统一信息流，同时兼顾封面、时长和阅读动作。',
        content: '播客和视频的入口虽然类似，但在展示密度和交互节奏上差异很大。\n\n鸿蒙端可以先沿用统一的数据模型，再在 ViewType 上决定布局差异，而不是拆成完全独立的数据层。\n\n这样未来接入视频页签时，会比单独维护一套结构更稳定。',
        author: 'Dev Weekly',
        publishedAt: Date.now() - 30 * 60 * 60 * 1000,
        readingTimeMinutes: 7,
        tags: ['视频', '播客', 'ArkUI'],
        isRead: false,
        isStarred: true,
        createdAt: Date.now() - 30 * 60 * 60 * 1000,
    },
];
let settingsCache: HarmonySettings = {
    autoRefresh: DEFAULT_HARMONY_SETTINGS.autoRefresh,
    aiSummaryEnabled: DEFAULT_HARMONY_SETTINGS.aiSummaryEnabled,
    imageProxyEnabled: DEFAULT_HARMONY_SETTINGS.imageProxyEnabled,
    refreshIntervalMinutes: DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes,
    themeMode: DEFAULT_HARMONY_SETTINGS.themeMode,
    remoteFeedUrl: DEFAULT_HARMONY_SETTINGS.remoteFeedUrl,
};
let remoteEntryCache: Map<string, ArticleDetailModel> = new Map();
function findFeed(feedId: string): Feed | undefined {
    return FEEDS.find((feed: Feed) => feed.id === feedId);
}
function unreadCountByFeed(feedId: string): number {
    return ENTRIES.filter((entry: Entry) => entry.feedId === feedId && !entry.isRead).length;
}
function buildFeedWithCount(feed: Feed): FeedWithCount {
    return {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.siteUrl,
        description: feed.description,
        category: feed.category,
        view: feed.view,
        showInAll: feed.showInAll,
        lastFetched: feed.lastFetched,
        errorCount: feed.errorCount,
        createdAt: feed.createdAt,
        unreadCount: unreadCountByFeed(feed.id),
    };
}
function allFeedModels(): FeedCardModel[] {
    return FEEDS.map((feed: Feed) => toFeedCardModel(buildFeedWithCount(feed)));
}
function entryCardFromEntry(entry: Entry): EntryCardModel | undefined {
    const feed = findFeed(entry.feedId);
    if (!feed) {
        return undefined;
    }
    return toEntryCardModel(entry, feed);
}
function compactEntryCards(items: Array<EntryCardModel | undefined>): EntryCardModel[] {
    const result: EntryCardModel[] = [];
    items.forEach((item: EntryCardModel | undefined) => {
        if (item) {
            result.push(item);
        }
    });
    return result;
}
export class MockRepository {
    static dashboardMetrics(): DashboardMetric[] {
        const unreadEntries = ENTRIES.filter((entry: Entry) => !entry.isRead).length;
        const starredEntries = ENTRIES.filter((entry: Entry) => entry.isStarred).length;
        return [
            { label: '订阅源', value: `${FEEDS.length}`, hint: '已接入内容来源' },
            { label: '未读条目', value: `${unreadEntries}`, hint: '待浏览更新内容' },
            { label: '已收藏', value: `${starredEntries}`, hint: '可作为稍后阅读入口' },
        ];
    }
    static feeds(): FeedCardModel[] {
        return allFeedModels();
    }
    static featuredEntries(): EntryCardModel[] {
        const cards = ENTRIES
            .slice()
            .sort((left: Entry, right: Entry) => right.publishedAt - left.publishedAt)
            .map((entry: Entry) => entryCardFromEntry(entry));
        return compactEntryCards(cards);
    }
    static entriesByFeed(feedId: string): EntryCardModel[] {
        const cards = ENTRIES
            .filter((entry: Entry) => entry.feedId === feedId)
            .sort((left: Entry, right: Entry) => right.publishedAt - left.publishedAt)
            .map((entry: Entry) => entryCardFromEntry(entry));
        return compactEntryCards(cards);
    }
    static feedById(feedId: string): FeedCardModel | undefined {
        const feed = findFeed(feedId);
        if (!feed) {
            return undefined;
        }
        return toFeedCardModel(buildFeedWithCount(feed));
    }
    static entryById(entryId: string): ArticleDetailModel | undefined {
        const entry = ENTRIES.find((item: Entry) => item.id === entryId);
        if (!entry) {
            return remoteEntryCache.get(entryId);
        }
        const feed = findFeed(entry.feedId);
        if (!feed) {
            return undefined;
        }
        return toArticleDetailModel(entry, feed);
    }
    static settings(): HarmonySettings {
        return {
            autoRefresh: settingsCache.autoRefresh,
            aiSummaryEnabled: settingsCache.aiSummaryEnabled,
            imageProxyEnabled: settingsCache.imageProxyEnabled,
            refreshIntervalMinutes: settingsCache.refreshIntervalMinutes,
            themeMode: settingsCache.themeMode,
            remoteFeedUrl: settingsCache.remoteFeedUrl,
        };
    }
    static saveSettings(next: HarmonySettings): HarmonySettings {
        settingsCache = {
            autoRefresh: next.autoRefresh,
            aiSummaryEnabled: next.aiSummaryEnabled,
            imageProxyEnabled: next.imageProxyEnabled,
            refreshIntervalMinutes: next.refreshIntervalMinutes,
            themeMode: next.themeMode,
            remoteFeedUrl: next.remoteFeedUrl,
        };
        return MockRepository.settings();
    }
    static async loadSettings(): Promise<HarmonySettings> {
        const loaded = await AppPreferenceService.loadSettings();
        settingsCache = loaded;
        return MockRepository.settings();
    }
    static async persistSettings(next: HarmonySettings): Promise<HarmonySettings> {
        settingsCache = next;
        const saved = await AppPreferenceService.saveSettings(next);
        settingsCache = saved;
        return MockRepository.settings();
    }
    static async remoteFeaturedEntries(): Promise<RemoteFeedResult> {
        const settings = await MockRepository.loadSettings();
        try {
            const result = await RssFeedService.fetchFeaturedEntries(settings.remoteFeedUrl);
            const nextCache: Map<string, ArticleDetailModel> = new Map();
            result.entries.forEach((entry: EntryCardModel) => {
                nextCache.set(entry.id, {
                    id: entry.id,
                    feedId: entry.feedId,
                    title: entry.title,
                    summary: entry.summary,
                    author: entry.author,
                    publishedLabel: entry.publishedLabel,
                    readingLabel: entry.readingLabel,
                    tags: entry.tags,
                    feedTitle: entry.feedTitle,
                    feedCategory: entry.feedCategory,
                    viewLabel: entry.viewLabel,
                    viewBadgeColor: entry.viewBadgeColor,
                    contentParagraphs: [
                        entry.summary,
                        '这是来自远程 RSS 的预览内容。当前版本已经打通远程请求和详情路由，但还没有接入完整正文抓取。',
                        `如果你需要更完整的阅读体验，下一步可以把这里接上 Readability 提取或服务端正文清洗。`,
                    ],
                    siteUrl: settings.remoteFeedUrl,
                });
            });
            remoteEntryCache = nextCache;
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.error(`Livo remote RSS fallback: ${message}`);
            return {
                entries: MockRepository.featuredEntries(),
                sourceLabel: `本地演示数据 · 已回退（${settings.remoteFeedUrl}）`,
                fallbackUsed: true,
            };
        }
    }
}

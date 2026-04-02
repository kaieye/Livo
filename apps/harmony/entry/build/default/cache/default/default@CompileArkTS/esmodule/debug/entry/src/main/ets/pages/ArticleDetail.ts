if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ArticleDetail_Params {
    topAvoidArea?: number;
    bottomAvoidArea?: number;
    entry?: ArticleDetailModel;
    actionHint?: string;
    aiSummary?: string;
    aiEnabled?: boolean;
    theme?: ThemePalette;
    isUpgradingLegacyContent?: boolean;
    starScale?: number;
    activeVideoBlockId?: string;
    activeVideoPlayableUrl?: string;
    activeVideoFallbackUrl?: string;
    isResolvingActiveVideo?: boolean;
    upgradedEntryIds?: Set<string>;
    videoWebController?: webview.WebviewController;
    nativeVideoController?: VideoController;
    webVideoUserAgent?: string;
}
import type Want from "@ohos:app.ability.Want";
import webview from "@ohos:web.webview";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { getStringParams, goBack, openVideoPlayer } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { ArticleAssistService } from "@bundle:com.livo.harmony/entry/ets/common/services/ArticleAssistService";
import { AppContextService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppContextService";
import { VideoResolverService } from "@bundle:com.livo.harmony/entry/ets/common/services/VideoResolverService";
import { isDirectVideoUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/FeedMediaUrl";
import { resolveArticleSourceUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/ArticleSourceUrl";
import { resolveYouTubePlaybackDisplay } from "@bundle:com.livo.harmony/entry/ets/common/utils/YouTubePlaybackDisplay";
import { resolveVideoPlaybackTarget } from "@bundle:com.livo.harmony/entry/ets/common/utils/VideoPlaybackTarget";
import { shouldOpenYouTubeExternallyOnFallback, shouldUseYouTubeWebFallback, } from "@bundle:com.livo.harmony/entry/ets/common/utils/YouTubePlaybackMode";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { isLegacyPlainArticleContent, } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { ArticleContentBlock, ArticleDetailModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { HEADER_BACK_SLOT_SIZE, PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
class ArticleDetail extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__topAvoidArea = this.createStorageProp('topAvoidArea', 0, "topAvoidArea");
        this.__bottomAvoidArea = this.createStorageProp('bottomAvoidArea', 0, "bottomAvoidArea");
        this.__entry = new ObservedPropertyObjectPU(undefined, this, "entry");
        this.__actionHint = new ObservedPropertySimplePU('', this, "actionHint");
        this.__aiSummary = new ObservedPropertySimplePU('', this, "aiSummary");
        this.__aiEnabled = new ObservedPropertySimplePU(false, this, "aiEnabled");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__isUpgradingLegacyContent = new ObservedPropertySimplePU(false, this, "isUpgradingLegacyContent");
        this.__starScale = new ObservedPropertySimplePU(1, this, "starScale");
        this.__activeVideoBlockId = new ObservedPropertySimplePU('', this, "activeVideoBlockId");
        this.__activeVideoPlayableUrl = new ObservedPropertySimplePU('', this, "activeVideoPlayableUrl");
        this.__activeVideoFallbackUrl = new ObservedPropertySimplePU('', this, "activeVideoFallbackUrl");
        this.__isResolvingActiveVideo = new ObservedPropertySimplePU(false, this, "isResolvingActiveVideo");
        this.upgradedEntryIds = new Set<string>();
        this.videoWebController = new webview.WebviewController();
        this.nativeVideoController = new VideoController();
        this.webVideoUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: ArticleDetail_Params) {
        if (params.entry !== undefined) {
            this.entry = params.entry;
        }
        if (params.actionHint !== undefined) {
            this.actionHint = params.actionHint;
        }
        if (params.aiSummary !== undefined) {
            this.aiSummary = params.aiSummary;
        }
        if (params.aiEnabled !== undefined) {
            this.aiEnabled = params.aiEnabled;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.isUpgradingLegacyContent !== undefined) {
            this.isUpgradingLegacyContent = params.isUpgradingLegacyContent;
        }
        if (params.starScale !== undefined) {
            this.starScale = params.starScale;
        }
        if (params.activeVideoBlockId !== undefined) {
            this.activeVideoBlockId = params.activeVideoBlockId;
        }
        if (params.activeVideoPlayableUrl !== undefined) {
            this.activeVideoPlayableUrl = params.activeVideoPlayableUrl;
        }
        if (params.activeVideoFallbackUrl !== undefined) {
            this.activeVideoFallbackUrl = params.activeVideoFallbackUrl;
        }
        if (params.isResolvingActiveVideo !== undefined) {
            this.isResolvingActiveVideo = params.isResolvingActiveVideo;
        }
        if (params.upgradedEntryIds !== undefined) {
            this.upgradedEntryIds = params.upgradedEntryIds;
        }
        if (params.videoWebController !== undefined) {
            this.videoWebController = params.videoWebController;
        }
        if (params.nativeVideoController !== undefined) {
            this.nativeVideoController = params.nativeVideoController;
        }
        if (params.webVideoUserAgent !== undefined) {
            this.webVideoUserAgent = params.webVideoUserAgent;
        }
    }
    updateStateVars(params: ArticleDetail_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__topAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__bottomAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__entry.purgeDependencyOnElmtId(rmElmtId);
        this.__actionHint.purgeDependencyOnElmtId(rmElmtId);
        this.__aiSummary.purgeDependencyOnElmtId(rmElmtId);
        this.__aiEnabled.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__isUpgradingLegacyContent.purgeDependencyOnElmtId(rmElmtId);
        this.__starScale.purgeDependencyOnElmtId(rmElmtId);
        this.__activeVideoBlockId.purgeDependencyOnElmtId(rmElmtId);
        this.__activeVideoPlayableUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__activeVideoFallbackUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__isResolvingActiveVideo.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__topAvoidArea.aboutToBeDeleted();
        this.__bottomAvoidArea.aboutToBeDeleted();
        this.__entry.aboutToBeDeleted();
        this.__actionHint.aboutToBeDeleted();
        this.__aiSummary.aboutToBeDeleted();
        this.__aiEnabled.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__isUpgradingLegacyContent.aboutToBeDeleted();
        this.__starScale.aboutToBeDeleted();
        this.__activeVideoBlockId.aboutToBeDeleted();
        this.__activeVideoPlayableUrl.aboutToBeDeleted();
        this.__activeVideoFallbackUrl.aboutToBeDeleted();
        this.__isResolvingActiveVideo.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __topAvoidArea: ObservedPropertyAbstractPU<number>;
    get topAvoidArea() {
        return this.__topAvoidArea.get();
    }
    set topAvoidArea(newValue: number) {
        this.__topAvoidArea.set(newValue);
    }
    private __bottomAvoidArea: ObservedPropertyAbstractPU<number>;
    get bottomAvoidArea() {
        return this.__bottomAvoidArea.get();
    }
    set bottomAvoidArea(newValue: number) {
        this.__bottomAvoidArea.set(newValue);
    }
    private __entry?: ObservedPropertyObjectPU<ArticleDetailModel>;
    get entry() {
        return this.__entry.get();
    }
    set entry(newValue: ArticleDetailModel) {
        this.__entry.set(newValue);
    }
    private __actionHint: ObservedPropertySimplePU<string>;
    get actionHint() {
        return this.__actionHint.get();
    }
    set actionHint(newValue: string) {
        this.__actionHint.set(newValue);
    }
    private __aiSummary: ObservedPropertySimplePU<string>;
    get aiSummary() {
        return this.__aiSummary.get();
    }
    set aiSummary(newValue: string) {
        this.__aiSummary.set(newValue);
    }
    private __aiEnabled: ObservedPropertySimplePU<boolean>;
    get aiEnabled() {
        return this.__aiEnabled.get();
    }
    set aiEnabled(newValue: boolean) {
        this.__aiEnabled.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __isUpgradingLegacyContent: ObservedPropertySimplePU<boolean>;
    get isUpgradingLegacyContent() {
        return this.__isUpgradingLegacyContent.get();
    }
    set isUpgradingLegacyContent(newValue: boolean) {
        this.__isUpgradingLegacyContent.set(newValue);
    }
    private __starScale: ObservedPropertySimplePU<number>;
    get starScale() {
        return this.__starScale.get();
    }
    set starScale(newValue: number) {
        this.__starScale.set(newValue);
    }
    private __activeVideoBlockId: ObservedPropertySimplePU<string>;
    get activeVideoBlockId() {
        return this.__activeVideoBlockId.get();
    }
    set activeVideoBlockId(newValue: string) {
        this.__activeVideoBlockId.set(newValue);
    }
    private __activeVideoPlayableUrl: ObservedPropertySimplePU<string>;
    get activeVideoPlayableUrl() {
        return this.__activeVideoPlayableUrl.get();
    }
    set activeVideoPlayableUrl(newValue: string) {
        this.__activeVideoPlayableUrl.set(newValue);
    }
    private __activeVideoFallbackUrl: ObservedPropertySimplePU<string>;
    get activeVideoFallbackUrl() {
        return this.__activeVideoFallbackUrl.get();
    }
    set activeVideoFallbackUrl(newValue: string) {
        this.__activeVideoFallbackUrl.set(newValue);
    }
    private __isResolvingActiveVideo: ObservedPropertySimplePU<boolean>;
    get isResolvingActiveVideo() {
        return this.__isResolvingActiveVideo.get();
    }
    set isResolvingActiveVideo(newValue: boolean) {
        this.__isResolvingActiveVideo.set(newValue);
    }
    private upgradedEntryIds: Set<string>;
    private videoWebController: webview.WebviewController;
    private nativeVideoController: VideoController;
    private readonly webVideoUserAgent: string;
    private animateWithUiContext(options: AnimateParam, event: () => void): void {
        this.getUIContext().animateTo(options, event);
    }
    aboutToAppear(): void {
        this.theme = ThemeService.currentPalette();
        void this.loadEntry(true);
    }
    private entryId(): string {
        const params = getStringParams();
        return params?.entryId ?? '';
    }
    private async loadEntry(markRead: boolean): Promise<void> {
        const entryId = this.entryId();
        if (!entryId) {
            this.entry = undefined;
            return;
        }
        if (markRead) {
            await AppRepository.markRead(entryId, true);
        }
        const params = getStringParams();
        const entryJson = params?.entryJson as string;
        if (entryJson) {
            try {
                const parsed = JSON.parse(entryJson) as ArticleDetailModel;
                if (parsed) {
                    this.entry = parsed;
                    this.actionHint = '';
                    return;
                }
            }
            catch (e) {
                console.error('Failed to parse entryJson', e);
            }
        }
        this.entry = await AppRepository.entryById(entryId);
        const upgraded = await this.upgradeLegacyEntryIfNeeded();
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        this.aiEnabled = settings.aiSummaryEnabled;
        this.aiSummary = this.entry
            ? ArticleAssistService.summarize(this.entry.title, this.entry.summary, this.entry.contentParagraphs)
            : '';
        if (!upgraded) {
            this.actionHint = markRead ? '已标记为已读' : '内容已刷新';
        }
    }
    private async toggleStar(): Promise<void> {
        const entryId = this.entryId();
        if (!entryId) {
            return;
        }
        this.animateWithUiContext({ duration: 150, curve: Curve.EaseOut }, () => {
            this.starScale = 1.4;
        });
        await AppRepository.toggleStar(entryId);
        await this.loadEntry(false);
        this.actionHint = this.entry?.isStarred ? '已收藏' : '已取消收藏';
        setTimeout(() => {
            this.animateWithUiContext({ duration: 300, curve: Curve.FastOutSlowIn }, () => {
                this.starScale = 1.0;
            });
        }, 150);
    }
    private async upgradeLegacyEntryIfNeeded(): Promise<boolean> {
        const current = this.entry;
        if (!current) {
            return false;
        }
        if (this.upgradedEntryIds.has(current.id)) {
            return false;
        }
        const rawContent = current.contentParagraphs.join('\n\n').trim();
        if (!isLegacyPlainArticleContent(rawContent)) {
            return false;
        }
        this.upgradedEntryIds.add(current.id);
        this.isUpgradingLegacyContent = true;
        this.actionHint = '正在刷新旧版正文格式...';
        try {
            await AppRepository.refreshFeed(current.feedId);
            const refreshed = await AppRepository.entryById(current.id);
            if (refreshed) {
                this.entry = refreshed;
            }
            this.actionHint = '已刷新正文排版';
            return true;
        }
        catch (_) {
            this.actionHint = '旧版正文刷新失败，已保留本地内容';
            return true;
        }
        finally {
            this.isUpgradingLegacyContent = false;
        }
    }
    private async openExternalUrl(url: string): Promise<void> {
        const trimmed = (url || '').trim();
        if (!trimmed) {
            return;
        }
        try {
            const want: Want = {
                action: 'action.view',
                entities: ['entity.default'],
                uri: trimmed,
            };
            await AppContextService.getContext().startAbility(want);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : `${error}`;
            console.error(`Failed to open external url: ${message}`);
            this.actionHint = '打开视频失败';
        }
    }
    private extractYouTubeVideoId(value: string): string {
        return VideoResolverService.extractYouTubeVideoId(value);
    }
    private extractBilibiliVideoToken(value: string): string {
        const bvid = (value || '').match(/(?:\/video\/|[?&]bvid=)(BV[a-zA-Z0-9]+)/i)?.[1];
        if (bvid) {
            return `BV:${bvid}`;
        }
        const aid = (value || '').match(/(?:\/video\/av|[?&]aid=)(\d+)/i)?.[1];
        if (aid) {
            return `AV:${aid}`;
        }
        return '';
    }
    private inAppVideoUrl(videoUrl: string): string {
        const youTubeId = this.extractYouTubeVideoId(videoUrl);
        if (youTubeId) {
            return this.activeVideoFallbackUrl;
        }
        const bilibiliToken = this.extractBilibiliVideoToken(videoUrl);
        if (bilibiliToken.startsWith('BV:')) {
            return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&bvid=${encodeURIComponent(bilibiliToken.substring(3))}`;
        }
        if (bilibiliToken.startsWith('AV:')) {
            return `https://www.bilibili.com/blackboard/newplayer.html?autoplay=true&danmaku=true&highQuality=true&aid=${encodeURIComponent(bilibiliToken.substring(3))}`;
        }
        return videoUrl;
    }
    private cleanText(value: string): string {
        return (value || '')
            .replace(/https?:\/\/[^\s]+/gi, ' ')
            .replace(/\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#@]/g, ' ')
            .replace(/[._-]+/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    private isYouTubeVideo(videoUrl: string): boolean {
        return this.extractYouTubeVideoId(videoUrl).length > 0;
    }
    private isDirectVideoFile(videoUrl: string): boolean {
        return isDirectVideoUrl(videoUrl);
    }
    private sourceUrl(): string {
        if (!this.entry) {
            return '';
        }
        return resolveArticleSourceUrl({
            articleUrl: this.entry.articleUrl,
            siteUrl: this.entry.siteUrl,
            contentBlocks: this.entry.contentBlocks,
        });
    }
    private sourceLabel(): string {
        const hasVideoBlock = !!this.entry?.contentBlocks.find((block: ArticleContentBlock) => block.type === 'video');
        return hasVideoBlock ? '视频来源' : '原始来源';
    }
    private shouldRenderSummary(): boolean {
        const summary = this.cleanText(this.entry?.summary ?? '');
        if (!summary) {
            return false;
        }
        const title = this.cleanText(this.entry?.title ?? '');
        if (title && (summary === title || summary.includes(title) || title.includes(summary))) {
            return false;
        }
        const firstParagraphBlock = this.entry?.contentBlocks.find((block: ArticleContentBlock) => block.type === 'paragraph' && block.text);
        const firstParagraph = this.cleanText(firstParagraphBlock?.text ?? this.entry?.contentParagraphs[0] ?? '');
        if (firstParagraph && (summary === firstParagraph || summary.includes(firstParagraph) || firstParagraph.includes(summary))) {
            return false;
        }
        const openingParagraphs = this.cleanText((this.entry?.contentParagraphs ?? []).slice(0, 3).join(' '));
        if (openingParagraphs && (openingParagraphs.includes(summary) || summary.includes(openingParagraphs))) {
            return false;
        }
        return true;
    }
    private shouldRenderParagraphBlock(block: ArticleContentBlock, index: number): boolean {
        if (block.type !== 'paragraph' || !block.text) {
            return true;
        }
        const normalizedParagraph = this.cleanText(block.text);
        if (!normalizedParagraph) {
            return false;
        }
        const title = this.cleanText(this.entry?.title ?? '');
        if (title && (normalizedParagraph === title || normalizedParagraph.includes(title))) {
            return false;
        }
        if (!this.shouldRenderSummary()) {
            return true;
        }
        const normalizedSummary = this.cleanText(this.entry?.summary ?? '');
        if (!normalizedSummary) {
            return true;
        }
        if (index <= 2 && (normalizedParagraph === normalizedSummary
            || normalizedParagraph.includes(normalizedSummary)
            || normalizedSummary.includes(normalizedParagraph))) {
            return false;
        }
        return true;
    }
    private isVideoPlaying(block: ArticleContentBlock): boolean {
        return this.activeVideoBlockId === block.id;
    }
    private playVideo(block: ArticleContentBlock): void {
        const playbackTarget = resolveVideoPlaybackTarget(this.isYouTubeVideo(block.videoUrl), this.isDirectVideoFile(block.videoUrl));
        if (playbackTarget === 'dedicated') {
            void openVideoPlayer(this.entry?.title || '视频播放', block.videoUrl, block.imageUrl || '');
            return;
        }
        this.activeVideoBlockId = block.id;
        this.activeVideoPlayableUrl = '';
        this.activeVideoFallbackUrl = '';
        this.isResolvingActiveVideo = false;
        this.actionHint = '';
        if (this.isDirectVideoFile(block.videoUrl)) {
            this.activeVideoPlayableUrl = block.videoUrl;
            return;
        }
        if (this.isYouTubeVideo(block.videoUrl)) {
            this.isResolvingActiveVideo = true;
            this.actionHint = '正在解析视频地址...';
            void this.resolveAndPlayYouTubeVideo(block.videoUrl);
        }
    }
    private stopVideo(): void {
        this.activeVideoBlockId = '';
        this.activeVideoPlayableUrl = '';
        this.activeVideoFallbackUrl = '';
        this.isResolvingActiveVideo = false;
        try {
            this.nativeVideoController.stop();
        }
        catch (_) { }
    }
    private async resolveAndPlayYouTubeVideo(videoUrl: string): Promise<void> {
        const expectedVideoUrl = videoUrl;
        const resolution = await VideoResolverService.resolveYouTubePlayback(videoUrl);
        if (!this.isYouTubeVideo(expectedVideoUrl) || this.activeVideoBlockId.length === 0) {
            return;
        }
        this.isResolvingActiveVideo = false;
        const displayState = resolveYouTubePlaybackDisplay(resolution.playableUrl, shouldUseYouTubeWebFallback() ? resolution.fallbackUrl : '');
        this.activeVideoPlayableUrl = displayState.playableUrl;
        this.activeVideoFallbackUrl = displayState.fallbackUrl;
        if (displayState.playableUrl) {
            this.actionHint = displayState.actionHint;
            return;
        }
        if (shouldOpenYouTubeExternallyOnFallback()) {
            this.stopVideo();
            this.actionHint = '正在外部打开 YouTube 视频';
            await this.openExternalUrl(videoUrl);
            this.actionHint = '已在外部打开 YouTube 视频';
            return;
        }
        this.actionHint = displayState.actionHint;
    }
    private MetaBadge(text: string, active?: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(text);
            Text.fontSize(11);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(active ? '#FFFFFF' : this.theme.textSecondary);
            Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
            Text.backgroundColor(active ? this.theme.accent : this.theme.elevated);
            Text.borderRadius(999);
        }, Text);
        Text.pop();
    }
    private HeaderIconAction(symbol: Resource, size: number, onTap?: () => void, symbolColors?: ResourceColor[], backgroundColor?: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(HEADER_BACK_SLOT_SIZE);
            Row.height(HEADER_BACK_SLOT_SIZE);
            Row.justifyContent(FlexAlign.Center);
            Row.alignItems(VerticalAlign.Center);
            Row.backgroundColor(backgroundColor ?? Color.Transparent);
            Row.borderRadius(HEADER_BACK_SLOT_SIZE);
            Row.clickEffect({ level: ClickEffectLevel.LIGHT });
            Row.onClick(() => {
                if (onTap) {
                    onTap();
                }
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(symbol);
            SymbolGlyph.fontSize(size);
            SymbolGlyph.fontColor(symbolColors ?? [this.theme.textSecondary]);
            SymbolGlyph.renderingStrategy(symbol === { "id": 125832415, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }
                ? SymbolRenderingStrategy.MULTIPLE_COLOR
                : SymbolRenderingStrategy.SINGLE);
        }, SymbolGlyph);
        Row.pop();
    }
    private HeaderActions(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 4 });
            Row.height(HEADER_BACK_SLOT_SIZE);
        }, Row);
        this.HeaderIconAction.bind(this)({ "id": 125832415, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, 24, () => { this.actionHint = 'AI 助手功能开发中...'; }, [this.theme.accent, this.theme.textSecondary]);
        this.HeaderIconAction.bind(this)({ "id": 125831499, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, 22, () => { this.actionHint = '分享功能开发中...'; });
        this.HeaderIconAction.bind(this)({ get id() {
                return typeof __getResourceId__ === "function" ? __getResourceId__(this) : -1;
            }, "type": -1, params: [this.entry?.isStarred ? 'sys.symbol.star_fill' : 'sys.symbol.star'], "bundleName": "com.livo.harmony", "moduleName": "entry" }, 22, () => { void this.toggleStar(); }, [this.entry?.isStarred ? this.theme.accent : this.theme.textSecondary], undefined);
        Row.pop();
    }
    private ContentBlockItem(block: ArticleContentBlock, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (block.type === 'image' && block.imageUrl) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 0 });
                        Column.width('100%');
                        Column.clip(true);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(block.imageUrl);
                        Image.width('100%');
                        Image.constraintSize({ minHeight: 180, maxHeight: 520 });
                        Image.objectFit(ImageFit.Contain);
                        Image.borderRadius(16);
                    }, Image);
                    Column.pop();
                });
            }
            else if (block.type === 'video' && block.videoUrl) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.clickEffect({ level: ClickEffectLevel.MIDDLE });
                        Column.onClick(() => {
                            if (!this.isVideoPlaying(block)) {
                                this.playVideo(block);
                            }
                        });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.isVideoPlaying(block)) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create({ space: 10 });
                                    Column.width('100%');
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    if (this.isDirectVideoFile(block.videoUrl)) {
                                        this.ifElseBranchUpdateFunction(0, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Video.create({
                                                    src: this.activeVideoPlayableUrl || block.videoUrl,
                                                    controller: this.nativeVideoController,
                                                    previewUri: block.imageUrl || '',
                                                });
                                                Video.width('100%');
                                                Video.height(232);
                                                Video.borderRadius(18);
                                                Video.controls(true);
                                                Video.autoPlay(true);
                                                Video.objectFit(ImageFit.Contain);
                                                Video.onError(() => {
                                                    this.actionHint = '应用内播放失败，请稍后重试';
                                                });
                                            }, Video);
                                        });
                                    }
                                    else if (this.isYouTubeVideo(block.videoUrl)) {
                                        this.ifElseBranchUpdateFunction(1, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                If.create();
                                                if (this.activeVideoPlayableUrl) {
                                                    this.ifElseBranchUpdateFunction(0, () => {
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Video.create({
                                                                src: this.activeVideoPlayableUrl,
                                                                controller: this.nativeVideoController,
                                                                previewUri: block.imageUrl || '',
                                                            });
                                                            Video.width('100%');
                                                            Video.height(232);
                                                            Video.borderRadius(18);
                                                            Video.controls(true);
                                                            Video.autoPlay(true);
                                                            Video.objectFit(ImageFit.Contain);
                                                            Video.onError(() => {
                                                                this.actionHint = '应用内播放失败，请稍后重试';
                                                            });
                                                        }, Video);
                                                    });
                                                }
                                                else if (this.isResolvingActiveVideo) {
                                                    this.ifElseBranchUpdateFunction(1, () => {
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Column.create({ space: 10 });
                                                            Column.width('100%');
                                                            Column.height(232);
                                                            Column.justifyContent(FlexAlign.Center);
                                                            Column.alignItems(HorizontalAlign.Center);
                                                            Column.backgroundColor(this.theme.elevated);
                                                            Column.borderRadius(18);
                                                        }, Column);
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            LoadingProgress.create();
                                                            LoadingProgress.width(28);
                                                            LoadingProgress.height(28);
                                                            LoadingProgress.color(this.theme.accent);
                                                        }, LoadingProgress);
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Text.create('正在解析视频地址...');
                                                            Text.fontSize(13);
                                                            Text.fontColor(this.theme.textSecondary);
                                                        }, Text);
                                                        Text.pop();
                                                        Column.pop();
                                                    });
                                                }
                                                else if (shouldUseYouTubeWebFallback() && this.activeVideoFallbackUrl) {
                                                    this.ifElseBranchUpdateFunction(2, () => {
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Web.create({
                                                                src: this.activeVideoFallbackUrl,
                                                                controller: this.videoWebController,
                                                            });
                                                            Web.width('100%');
                                                            Web.height(232);
                                                            Web.borderRadius(18);
                                                            Web.javaScriptAccess(true);
                                                            Web.domStorageAccess(true);
                                                            Web.mixedMode(MixedMode.All);
                                                            Web.onControllerAttached(() => {
                                                                try {
                                                                    webview.WebCookieManager.putAcceptCookieEnabled(true);
                                                                    webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);
                                                                    this.videoWebController.setCustomUserAgent(this.webVideoUserAgent);
                                                                }
                                                                catch (_error) {
                                                                }
                                                            });
                                                            Web.onPageBegin((_event: OnPageBeginEvent) => {
                                                                this.actionHint = '正在加载 YouTube 播放器...';
                                                            });
                                                            Web.onPageEnd((_event: OnPageEndEvent) => {
                                                                this.actionHint = '';
                                                            });
                                                            Web.onErrorReceive((event: OnErrorReceiveEvent) => {
                                                                if (event.request?.isMainFrame()) {
                                                                    this.actionHint = 'YouTube 播放器加载失败，请稍后重试';
                                                                }
                                                            });
                                                        }, Web);
                                                    });
                                                }
                                                else {
                                                    this.ifElseBranchUpdateFunction(3, () => {
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Column.create({ space: 10 });
                                                            Column.width('100%');
                                                            Column.height(232);
                                                            Column.justifyContent(FlexAlign.Center);
                                                            Column.alignItems(HorizontalAlign.Center);
                                                            Column.backgroundColor(this.theme.elevated);
                                                            Column.borderRadius(18);
                                                        }, Column);
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Text.create('未能解析应用内直链');
                                                            Text.fontSize(14);
                                                            Text.fontWeight(FontWeight.Medium);
                                                            Text.fontColor(this.theme.textPrimary);
                                                        }, Text);
                                                        Text.pop();
                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                            Text.create('当前视频暂时无法解析直链，请稍后重试');
                                                            Text.fontSize(12);
                                                            Text.fontColor(this.theme.textSecondary);
                                                        }, Text);
                                                        Text.pop();
                                                        Column.pop();
                                                    });
                                                }
                                            }, If);
                                            If.pop();
                                        });
                                    }
                                    else {
                                        this.ifElseBranchUpdateFunction(2, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Web.create({
                                                    src: this.inAppVideoUrl(block.videoUrl),
                                                    controller: this.videoWebController,
                                                });
                                                Web.width('100%');
                                                Web.height(232);
                                                Web.borderRadius(18);
                                                Web.javaScriptAccess(true);
                                                Web.domStorageAccess(true);
                                                Web.onPageEnd((_event: OnPageEndEvent) => {
                                                    this.actionHint = '';
                                                });
                                                Web.onErrorReceive((event: OnErrorReceiveEvent) => {
                                                    if (event.request?.isMainFrame()) {
                                                        this.actionHint = '应用内播放失败，可尝试外部打开';
                                                    }
                                                });
                                            }, Web);
                                        });
                                    }
                                }, If);
                                If.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 10 });
                                    Row.padding({ top: 2, bottom: 2 });
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('收起');
                                    Text.fontSize(13);
                                    Text.fontWeight(FontWeight.Medium);
                                    Text.fontColor(this.theme.textSecondary);
                                    Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
                                    Text.backgroundColor(this.theme.elevated);
                                    Text.borderRadius(999);
                                    Text.onClick(() => {
                                        this.stopVideo();
                                    });
                                }, Text);
                                Text.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    if (!this.isYouTubeVideo(block.videoUrl)) {
                                        this.ifElseBranchUpdateFunction(0, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Text.create('外部打开');
                                                Text.fontSize(13);
                                                Text.fontWeight(FontWeight.Medium);
                                                Text.fontColor('#FFFFFF');
                                                Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
                                                Text.backgroundColor(this.theme.accent);
                                                Text.borderRadius(999);
                                                Text.onClick(() => {
                                                    void this.openExternalUrl(block.videoUrl);
                                                });
                                            }, Text);
                                            Text.pop();
                                        });
                                    }
                                    else {
                                        this.ifElseBranchUpdateFunction(1, () => {
                                        });
                                    }
                                }, If);
                                If.pop();
                                Row.pop();
                                Column.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Stack.create({ alignContent: Alignment.Center });
                                    Stack.width('100%');
                                    Stack.clip(true);
                                    Stack.onClick(() => {
                                        this.playVideo(block);
                                    });
                                }, Stack);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    if (block.imageUrl) {
                                        this.ifElseBranchUpdateFunction(0, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Image.create(block.imageUrl);
                                                Image.width('100%');
                                                Image.constraintSize({ minHeight: 180, maxHeight: 260 });
                                                Image.objectFit(ImageFit.Cover);
                                                Image.borderRadius(18);
                                            }, Image);
                                        });
                                    }
                                    else {
                                        this.ifElseBranchUpdateFunction(1, () => {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                Row.create();
                                                Row.width('100%');
                                                Row.height(180);
                                                Row.backgroundColor(this.theme.elevated);
                                                Row.borderRadius(18);
                                            }, Row);
                                            Row.pop();
                                        });
                                    }
                                }, If);
                                If.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 8 });
                                    Row.padding({ left: 16, right: 16, top: 10, bottom: 10 });
                                    Row.backgroundColor('rgba(17,24,39,0.72)');
                                    Row.borderRadius(999);
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('播放视频');
                                    Text.fontSize(15);
                                    Text.fontWeight(FontWeight.Bold);
                                    Text.fontColor('#FFFFFF');
                                }, Text);
                                Text.pop();
                                Row.pop();
                                Stack.pop();
                            });
                        }
                    }, If);
                    If.pop();
                    Column.pop();
                });
            }
            else if (block.text) {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 0 });
                        Column.width('100%');
                        Column.padding({ left: 2, right: 2 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(block.text);
                        Text.fontSize(16);
                        Text.lineHeight(29);
                        Text.fontColor(this.theme.textPrimary);
                        Text.width('100%');
                        Text.textAlign(TextAlign.Start);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                });
            }
        }, If);
        If.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.padding({ top: this.topAvoidArea });
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 8 });
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '文章详情',
                        theme: this.theme,
                        showBackButton: true,
                        showTrailingBuilder: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => { void goBack(); },
                        trailingBuilder: () => {
                            this.HeaderActions.bind(this)();
                        }
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/ArticleDetail.ets", line: 667, col: 9 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '文章详情',
                            theme: this.theme,
                            showBackButton: true,
                            showTrailingBuilder: true,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => { void goBack(); },
                            trailingBuilder: () => {
                                this.HeaderActions.bind(this)();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '文章详情',
                        theme: this.theme,
                        showBackButton: true,
                        showTrailingBuilder: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.entry) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 18 });
                        Column.width('100%');
                        Column.padding({ bottom: this.bottomAvoidArea + 28 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 6, bottom: 2 });
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.title);
                        Text.fontSize(28);
                        Text.lineHeight(38);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.width('100%');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`${this.entry!.author} · ${this.entry!.publishedLabel}`);
                        Text.fontSize(13);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
                        Text.width('100%');
                    }, Text);
                    Text.pop();
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.entry!.tags.length > 0) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 8 });
                                    Row.width('100%');
                                    Row.margin({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING });
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = _item => {
                                        const tag = _item;
                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                            Text.create(tag);
                                            Text.fontSize(12);
                                            Text.fontColor(this.theme.textSecondary);
                                            Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                                            Text.backgroundColor(this.theme.elevated);
                                            Text.borderRadius(999);
                                        }, Text);
                                        Text.pop();
                                    };
                                    this.forEachUpdateFunction(elmtId, this.entry!.tags, forEachItemGenFunction, (tag: string) => tag, false, false);
                                }, ForEach);
                                ForEach.pop();
                                Row.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 20 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding({ left: 18, right: 18, top: 12, bottom: 22 });
                        Column.margin({ top: 4, bottom: 16 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.shouldRenderSummary()) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.entry!.summary);
                                    Text.fontSize(16);
                                    Text.lineHeight(27);
                                    Text.fontColor(this.theme.textSecondary);
                                    Text.fontWeight(FontWeight.Medium);
                                    Text.width('100%');
                                }, Text);
                                Text.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.entry!.contentBlocks.length > 0) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = (_item, index: number) => {
                                        const block = _item;
                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                            If.create();
                                            if (this.shouldRenderParagraphBlock(block, index)) {
                                                this.ifElseBranchUpdateFunction(0, () => {
                                                    this.ContentBlockItem.bind(this)(block);
                                                });
                                            }
                                            else {
                                                this.ifElseBranchUpdateFunction(1, () => {
                                                });
                                            }
                                        }, If);
                                        If.pop();
                                    };
                                    this.forEachUpdateFunction(elmtId, this.entry!.contentBlocks, forEachItemGenFunction, (block: ArticleContentBlock) => block.id, true, false);
                                }, ForEach);
                                ForEach.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = _item => {
                                        const paragraph = _item;
                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                            Text.create(paragraph);
                                            Text.fontSize(16);
                                            Text.lineHeight(29);
                                            Text.fontColor(this.theme.textPrimary);
                                            Text.width('100%');
                                            Text.textAlign(TextAlign.Start);
                                        }, Text);
                                        Text.pop();
                                    };
                                    this.forEachUpdateFunction(elmtId, this.entry!.contentParagraphs, forEachItemGenFunction, (paragraph: string, index: number) => `${index}-${paragraph}`, false, true);
                                }, ForEach);
                                ForEach.pop();
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.sourceUrl()) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(`${this.sourceLabel()}：${this.sourceUrl()}`);
                                    Text.fontSize(13);
                                    Text.fontColor(this.theme.textMuted);
                                    Text.width('100%');
                                }, Text);
                                Text.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    Column.pop();
                    Column.pop();
                    Scroll.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('未找到内容');
                        Text.fontSize(24);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('请从订阅页重新进入一个条目。');
                        Text.fontSize(15);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "ArticleDetail";
    }
}
registerNamedRoute(() => new ArticleDetail(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/ArticleDetail", pageFullPath: "entry/src/main/ets/pages/ArticleDetail", integratedHsp: "false", moduleType: "followWithHap" });

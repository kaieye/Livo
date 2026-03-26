if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Discover_Params {
    query?: string;
    searchPlatform?: DiscoverSearchPlatform;
    theme?: ThemePalette;
    remoteResults?: ResolvedDiscoverCandidate[];
    isSearchingRemote?: boolean;
    searchSession?: number;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import type { FeedViewType } from '../common/models/LivoModels';
import { DiscoverRemoteSearchService } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverRemoteSearchService";
import { discoverFeedPlatform, discoverPlatformLabel, discoverViewLabel, filteredRecommendedFeedsByPlatform, normalizeDiscoverInput, preferredViewForPlatform, resolveKeywordCandidatesByPlatform, resolveProfileCandidatesByPlatform, searchedRecommendedFeedsByPlatform, } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverService";
import type { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverService";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
interface DirectUrlResult {
    targetUrl: string;
    siteUrl: string;
    title: string;
    description: string;
}
function createDiscoverResultFromFeed(feed: RecommendedFeed): ResolvedDiscoverCandidate {
    return {
        targetUrl: feed.url,
        targetTitle: feed.title,
        targetView: feed.view,
        description: feed.description,
        siteUrl: feed.siteUrl,
        sourceKind: '推荐',
    };
}
class Discover extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__query = new ObservedPropertySimplePU('', this, "query");
        this.__searchPlatform = new ObservedPropertySimplePU('all', this, "searchPlatform");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.__remoteResults = new ObservedPropertyObjectPU([], this, "remoteResults");
        this.__isSearchingRemote = new ObservedPropertySimplePU(false, this, "isSearchingRemote");
        this.searchSession = 0;
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Discover_Params) {
        if (params.query !== undefined) {
            this.query = params.query;
        }
        if (params.searchPlatform !== undefined) {
            this.searchPlatform = params.searchPlatform;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.remoteResults !== undefined) {
            this.remoteResults = params.remoteResults;
        }
        if (params.isSearchingRemote !== undefined) {
            this.isSearchingRemote = params.isSearchingRemote;
        }
        if (params.searchSession !== undefined) {
            this.searchSession = params.searchSession;
        }
    }
    updateStateVars(params: Discover_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__query.purgeDependencyOnElmtId(rmElmtId);
        this.__searchPlatform.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__remoteResults.purgeDependencyOnElmtId(rmElmtId);
        this.__isSearchingRemote.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__query.aboutToBeDeleted();
        this.__searchPlatform.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__remoteResults.aboutToBeDeleted();
        this.__isSearchingRemote.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __query: ObservedPropertySimplePU<string>;
    get query() {
        return this.__query.get();
    }
    set query(newValue: string) {
        this.__query.set(newValue);
    }
    private __searchPlatform: ObservedPropertySimplePU<DiscoverSearchPlatform>;
    get searchPlatform() {
        return this.__searchPlatform.get();
    }
    set searchPlatform(newValue: DiscoverSearchPlatform) {
        this.__searchPlatform.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __remoteResults: ObservedPropertyObjectPU<ResolvedDiscoverCandidate[]>;
    get remoteResults() {
        return this.__remoteResults.get();
    }
    set remoteResults(newValue: ResolvedDiscoverCandidate[]) {
        this.__remoteResults.set(newValue);
    }
    private __isSearchingRemote: ObservedPropertySimplePU<boolean>;
    get isSearchingRemote() {
        return this.__isSearchingRemote.get();
    }
    set isSearchingRemote(newValue: boolean) {
        this.__isSearchingRemote.set(newValue);
    }
    private searchSession: number;
    aboutToAppear(): void {
        void this.loadData();
    }
    private async loadData(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
    }
    private viewLabel(view: FeedViewType): string {
        return discoverViewLabel(view);
    }
    private normalizeUrl(value: string): string {
        return value.trim().replace(/\/+$/, '').toLowerCase();
    }
    private validateInputUrl(targetUrl: string): boolean {
        return /^https?:\/\/\S+$/i.test(targetUrl);
    }
    private hostOf(url: string): string {
        const matched = url.match(/^https?:\/\/([^/]+)/i);
        return matched?.[1] ? matched[1].replace(/^www\./i, '') : '';
    }
    private directUrlResult(): DirectUrlResult | undefined {
        const normalized = normalizeDiscoverInput(this.query);
        if (!this.validateInputUrl(normalized)) {
            return undefined;
        }
        const host = this.hostOf(normalized);
        return {
            targetUrl: normalized,
            siteUrl: host ? `https://${host}` : normalized,
            title: host || normalized,
            description: '直接使用这个地址进入订阅预览，并在下一页校验内容。',
        };
    }
    private resolvedCandidates(): ResolvedDiscoverCandidate[] {
        return resolveProfileCandidatesByPlatform(this.query.trim(), this.searchPlatform);
    }
    private keywordCandidates(): ResolvedDiscoverCandidate[] {
        return resolveKeywordCandidatesByPlatform(this.query, this.searchPlatform);
    }
    private localRecommendedResults(): RecommendedFeed[] {
        if (!this.query.trim()) {
            return [];
        }
        return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform).slice(0, 10);
    }
    private searchResults(): ResolvedDiscoverCandidate[] {
        if (this.remoteResults.length > 0) {
            return this.remoteResults;
        }
        return this.localRecommendedResults().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed));
    }
    private recommendedFallback(): RecommendedFeed[] {
        return filteredRecommendedFeedsByPlatform(this.searchPlatform).slice(0, 8);
    }
    private hasSearchResults(): boolean {
        return this.searchResults().length > 0;
    }
    private hasAnyResult(): boolean {
        return !!this.directUrlResult()
            || this.resolvedCandidates().length > 0
            || this.keywordCandidates().length > 0
            || this.hasSearchResults();
    }
    private async refreshRemoteResults(): Promise<void> {
        const trimmed = this.query.trim();
        const session = Date.now();
        this.searchSession = session;
        if (!trimmed) {
            this.remoteResults = [];
            this.isSearchingRemote = false;
            return;
        }
        if (this.directUrlResult() || this.resolvedCandidates().length > 0) {
            this.remoteResults = [];
            this.isSearchingRemote = false;
            return;
        }
        this.isSearchingRemote = true;
        try {
            const results = await DiscoverRemoteSearchService.search(trimmed, this.searchPlatform);
            if (this.searchSession !== session) {
                return;
            }
            this.remoteResults = results;
        }
        catch (_) {
            if (this.searchSession !== session) {
                return;
            }
            this.remoteResults = [];
        }
        finally {
            if (this.searchSession === session) {
                this.isSearchingRemote = false;
            }
        }
    }
    private openPreviewPage(targetUrl: string, targetTitle: string, targetView: FeedViewType, siteUrl: string, description: string, sourceKind: string, category: string): void {
        router.pushUrl({
            url: 'pages/DiscoverPreview',
            params: {
                targetUrl,
                targetTitle,
                view: `${targetView}`,
                siteUrl,
                description,
                sourceKind,
                category,
            },
        });
    }
    private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate): void {
        router.pushUrl({
            url: 'pages/DiscoverSubscribeConfig',
            params: {
                targetUrl: candidate.targetUrl,
                targetTitle: candidate.targetTitle,
                view: `${candidate.targetView}`,
                siteUrl: candidate.siteUrl,
                description: candidate.description,
                sourceKind: candidate.sourceKind,
                category: this.resolvedPlatformLabel(candidate),
            },
        });
    }
    private openDirectUrlResult(result: DirectUrlResult): void {
        this.openPreviewPage(result.targetUrl, result.title, preferredViewForPlatform(this.searchPlatform), result.siteUrl, result.description, '地址', discoverPlatformLabel(this.searchPlatform));
    }
    private openCandidate(candidate: ResolvedDiscoverCandidate): void {
        this.openPreviewPage(candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl, candidate.description, candidate.sourceKind, this.resolvedPlatformLabel(candidate));
    }
    private platformOptions(): DiscoverSearchPlatform[] {
        return ['all', 'youtube', 'bilibili', 'x', 'instagram'];
    }
    private platformColor(label: string): string {
        if (label === 'YouTube') {
            return '#FF3B30';
        }
        if (label === 'Instagram') {
            return '#E1306C';
        }
        if (label === 'Bilibili') {
            return '#00A1D6';
        }
        if (label === 'GitHub') {
            return '#111827';
        }
        if (label === 'X') {
            return '#111111';
        }
        if (label === '官方 RSS') {
            return '#16A34A';
        }
        if (label === 'RSSHub') {
            return '#2563EB';
        }
        if (label === 'Nitter') {
            return '#475569';
        }
        if (label === '关键词') {
            return '#7C3AED';
        }
        if (label === '推荐') {
            return '#F97316';
        }
        return this.theme.accent;
    }
    private faviconUrl(siteUrl: string): string {
        const host = this.hostOf(siteUrl);
        return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : '';
    }
    private recommendedPlatformLabel(feed: RecommendedFeed): string {
        const platform = discoverFeedPlatform(feed);
        if (platform === 'all') {
            const site = feed.siteUrl.toLowerCase();
            if (site.includes('openai.com')) {
                return 'OpenAI';
            }
            if (site.includes('github.')) {
                return 'GitHub';
            }
            return this.viewLabel(feed.view);
        }
        return discoverPlatformLabel(platform);
    }
    private resolvedPlatformLabel(candidate: ResolvedDiscoverCandidate): string {
        if (candidate.targetUrl.includes('/youtube/') || candidate.targetUrl.includes('youtube.com/feeds/videos.xml')) {
            return 'YouTube';
        }
        if (candidate.targetUrl.includes('/instagram/')) {
            return 'Instagram';
        }
        if (candidate.targetUrl.includes('/bilibili/')) {
            return 'Bilibili';
        }
        if (candidate.targetUrl.includes('/github/')) {
            return 'GitHub';
        }
        if (candidate.targetUrl.includes('/x/user/') || candidate.targetUrl.includes('/twitter/user/') || candidate.targetUrl.includes('nitter.')) {
            return 'X';
        }
        return this.viewLabel(candidate.targetView);
    }
    private resolvedCandidateAvatarUrl(candidate: ResolvedDiscoverCandidate): string {
        if (candidate.imageUrl) {
            return candidate.imageUrl;
        }
        const platform = this.resolvedPlatformLabel(candidate);
        if (platform === 'GitHub') {
            return 'https://github.githubassets.com/favicons/favicon.svg';
        }
        if (platform === 'YouTube') {
            return 'https://www.youtube.com/s/desktop/fe0e7cf8/img/favicon_144x144.png';
        }
        if (platform === 'Instagram') {
            return 'https://static.cdninstagram.com/rsrc.php/v4/yI/r/VsNE-OHk_8a.png';
        }
        if (platform === 'Bilibili') {
            return 'https://www.bilibili.com/favicon.ico';
        }
        if (platform === 'X') {
            return 'https://abs.twimg.com/favicons/twitter.3.ico';
        }
        return this.faviconUrl(candidate.siteUrl);
    }
    private initialsLabel(value: string): string {
        const trimmed = value.trim();
        if (!trimmed) {
            return '?';
        }
        return trimmed.substring(0, 1).toUpperCase();
    }
    private SectionTitle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.alignItems(VerticalAlign.Center);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('添加订阅');
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.width('100%');
        }, Text);
        Text.pop();
        Row.pop();
    }
    private PlatformChip(platform: DiscoverSearchPlatform, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(discoverPlatformLabel(platform));
            Context.animation({ duration: 180, curve: Curve.EaseInOut });
            Text.fontSize(11);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary);
            Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
            Text.backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.elevated);
            Text.borderRadius(999);
            Context.animation(null);
            Text.onClick(() => {
                this.searchPlatform = platform;
                void this.refreshRemoteResults();
            });
        }, Text);
        Text.pop();
    }
    private SearchPanel(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
            Column.padding(18);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.End });
            Stack.width('100%');
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.query, placeholder: '输入 RSS 地址、主页链接或关键字' });
            TextInput.backgroundColor(this.theme.elevated);
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.borderRadius(18);
            TextInput.padding({ left: 16, right: this.query.trim() ? 44 : 16, top: 14, bottom: 14 });
            TextInput.width('100%');
            TextInput.onChange((value: string) => {
                this.query = value;
                void this.refreshRemoteResults();
            });
        }, TextInput);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.query.trim()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('×');
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor(this.theme.textMuted);
                        Text.width(28);
                        Text.height(28);
                        Text.textAlign(TextAlign.Center);
                        Text.borderRadius(999);
                        Text.backgroundColor(this.theme.surface);
                        Text.margin({ right: 10 });
                        Text.onClick(() => {
                            this.query = '';
                            this.remoteResults = [];
                            this.isSearchingRemote = false;
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
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 10 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const platform = _item;
                this.PlatformChip.bind(this)(platform);
            };
            this.forEachUpdateFunction(elmtId, this.platformOptions(), forEachItemGenFunction, (platform: DiscoverSearchPlatform) => platform, false, false);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Column.pop();
    }
    private SectionHeader(title: string, count: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(17);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${count}`);
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private AvatarBox(imageUrl: string, fallbackLabel: string, accent: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (imageUrl) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(imageUrl);
                        Image.width(38);
                        Image.height(38);
                        Image.borderRadius(10);
                        Image.backgroundColor(this.theme.elevated);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(38);
                        Row.height(38);
                        Row.borderRadius(10);
                        Row.backgroundColor(accent);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.initialsLabel(fallbackLabel));
                        Text.fontSize(14);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#FFFFFF');
                    }, Text);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private ResultMeta(primary: string, secondary: string, tertiary: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 6 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(primary);
            Text.fontSize(10);
            Text.fontColor('#FFFFFF');
            Text.padding({ left: 8, right: 8, top: 4, bottom: 4 });
            Text.backgroundColor(this.platformColor(primary));
            Text.borderRadius(999);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(secondary);
            Text.fontSize(10);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (tertiary) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(tertiary);
                        Text.fontSize(10);
                        Text.fontColor(this.theme.textMuted);
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
    }
    private DirectUrlRow(result: DirectUrlResult | undefined, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (result) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 12 });
                        Row.width('100%');
                        Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
                        Row.backgroundColor(this.theme.surface);
                        Row.borderRadius(20);
                        Row.onClick(() => {
                            this.openDirectUrlResult(result);
                        });
                    }, Row);
                    this.AvatarBox.bind(this)('', result.title, this.theme.accent);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 4 });
                        Column.layoutWeight(1);
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(result.title);
                        Text.fontSize(15);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                    this.ResultMeta.bind(this)('地址', discoverPlatformLabel(this.searchPlatform), '');
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(result.targetUrl);
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                    Column.pop();
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private CandidateRow(candidate: ResolvedDiscoverCandidate, showDivider: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.layoutWeight(1);
            Row.onClick(() => {
                this.openCandidate(candidate);
            });
        }, Row);
        this.AvatarBox.bind(this)(this.resolvedCandidateAvatarUrl(candidate), candidate.targetTitle, this.platformColor(this.resolvedPlatformLabel(candidate)));
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 6 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(candidate.targetTitle);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(candidate.description);
            Text.fontSize(12);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('订阅');
            Button.type(ButtonType.Capsule);
            Button.fontSize(12);
            Button.fontWeight(FontWeight.Medium);
            Button.height(32);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.onClick(() => {
                this.openSubscribeConfigPage(candidate);
            });
        }, Button);
        Button.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (showDivider) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Divider.create();
                        Divider.strokeWidth(1);
                        Divider.color(this.theme.divider);
                        Divider.margin({ left: 16, right: 16 });
                    }, Divider);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    private CandidateSection(title: string, items: ResolvedDiscoverCandidate[], parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (items.length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)(title, items.length);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(24);
                        Column.clip(true);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const candidate = _item;
                            this.CandidateRow.bind(this)(candidate, index < items.length - 1);
                        };
                        this.forEachUpdateFunction(elmtId, items, forEachItemGenFunction, (candidate: ResolvedDiscoverCandidate) => `${title}-${candidate.targetUrl}`, true, false);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private SearchResultSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.hasSearchResults() || this.isSearchingRemote) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)('搜索结果', this.searchResults().length);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.isSearchingRemote && this.searchResults().length === 0) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 10 });
                                    Row.width('100%');
                                    Row.padding({ left: 16, right: 16, top: 16, bottom: 16 });
                                    Row.backgroundColor(this.theme.surface);
                                    Row.borderRadius(20);
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    LoadingProgress.create();
                                    LoadingProgress.width(20);
                                    LoadingProgress.height(20);
                                    LoadingProgress.color(this.theme.accent);
                                }, LoadingProgress);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('搜索中...');
                                    Text.fontSize(13);
                                    Text.fontColor(this.theme.textSecondary);
                                }, Text);
                                Text.pop();
                                Row.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create();
                                    Column.width('100%');
                                    Column.backgroundColor(this.theme.surface);
                                    Column.borderRadius(24);
                                    Column.clip(true);
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = (_item, index: number) => {
                                        const candidate = _item;
                                        this.CandidateRow.bind(this)(candidate, index < this.searchResults().length - 1);
                                    };
                                    this.forEachUpdateFunction(elmtId, this.searchResults(), forEachItemGenFunction, (candidate: ResolvedDiscoverCandidate) => `search-${candidate.targetUrl}`, true, false);
                                }, ForEach);
                                ForEach.pop();
                                Column.pop();
                            });
                        }
                    }, If);
                    If.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private RecommendedFallbackSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!this.query.trim() && this.recommendedFallback().length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)(this.searchPlatform === 'all' ? '推荐来源' : `${discoverPlatformLabel(this.searchPlatform)} 推荐`, this.recommendedFallback().length);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(24);
                        Column.clip(true);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const feed = _item;
                            this.CandidateRow.bind(this)(createDiscoverResultFromFeed(feed), index < this.recommendedFallback().length - 1);
                        };
                        this.forEachUpdateFunction(elmtId, this.recommendedFallback(), forEachItemGenFunction, (feed: RecommendedFeed) => `recommended-${feed.view}-${feed.url}`, true, false);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private NoResultState(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding({ left: 20, right: 20, top: 24, bottom: 24 });
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('没有匹配结果');
            Text.fontSize(17);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('换一个关键字，或者输入更完整的链接。');
            Text.fontSize(13);
            Text.lineHeight(20);
            Text.fontColor(this.theme.textSecondary);
            Text.textAlign(TextAlign.Center);
        }, Text);
        Text.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
            Column.justifyContent(FlexAlign.Start);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.width('100%');
            Column.padding({ left: 18, right: 18, top: 18, bottom: 10 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SectionTitle.bind(this)();
        this.SearchPanel.bind(this)();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.layoutWeight(1);
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.width('100%');
            Column.padding({ left: 18, right: 18, top: 0, bottom: 24 });
            Column.justifyContent(FlexAlign.Start);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.directUrlResult()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)('地址结果', 1);
                    this.DirectUrlRow.bind(this)(this.directUrlResult());
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.CandidateSection.bind(this)('识别结果', this.resolvedCandidates());
        this.CandidateSection.bind(this)('候选订阅', this.keywordCandidates());
        this.SearchResultSection.bind(this)();
        this.RecommendedFallbackSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.query.trim() && !this.hasAnyResult() && !this.isSearchingRemote) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.NoResultState.bind(this)();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(24);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'discover', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Discover.ets", line: 713, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            activeTab: 'discover',
                            theme: this.theme
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        activeTab: 'discover', theme: this.theme
                    });
                }
            }, { name: "BottomTabs" });
        }
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Discover";
    }
}
registerNamedRoute(() => new Discover(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Discover", pageFullPath: "entry/src/main/ets/pages/Discover", integratedHsp: "false", moduleType: "followWithHap" });

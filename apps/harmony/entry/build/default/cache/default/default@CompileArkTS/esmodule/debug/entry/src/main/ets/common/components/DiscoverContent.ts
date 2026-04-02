if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface DiscoverEntryDetailDestination_Params {
    discoverPathStack?: NavPathStack;
    entry?: Entry;
    feedTitle?: string;
    feedImageUrl?: string;
    theme?: ThemePalette;
}
interface DiscoverPreviewDestination_Params {
    discoverPathStack?: NavPathStack;
    discoverOverlayLevel?: number;
    targetUrl?: string;
    initialTargetTitle?: string;
    initialTargetSiteUrl?: string;
    initialTargetImageUrl?: string;
    initialTargetDescription?: string;
    targetCategory?: string;
    targetView?: FeedViewType;
    theme?: ThemePalette;
}
interface DiscoverSubscribeConfigDestination_Params {
    discoverPathStack?: NavPathStack;
    discoverOverlayLevel?: number;
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetImageUrl?: string;
    targetDescription?: string;
    targetCategory?: string;
    sourceKind?: string;
    initialSelectedView?: FeedViewType;
    theme?: ThemePalette;
}
interface DiscoverContent_Params {
    query?: string;
    searchPlatform?: DiscoverSearchPlatform;
    showPlatformChips?: boolean;
    isInteractingWithPlatformChips?: boolean;
    keepPlatformChipsOnBlur?: boolean;
    isPlatformSwitchSearching?: boolean;
    theme?: ThemePalette;
    remoteResults?: ResolvedDiscoverCandidate[];
    isSearchingRemote?: boolean;
    hasLoaded?: boolean;
    isLoadingPage?: boolean;
    subscribedFeeds?: Feed[];
    showBottomTabs?: boolean;
    reserveBottomTabInset?: boolean;
    inheritedTheme?: ThemePalette;
    bottomAvoidArea?: number;
    discoverOverlayLevel?: number;
    feedsChangedAt?: number;
    discoverSearchDismissAt?: number;
    discoverPathStack?: NavPathStack;
    onReady?: () => void;
    searchSession?: number;
    platformSwitchSession?: number;
    searchInputController?: TextInputController;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { openArticleDetail } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { AvatarTile } from "@bundle:com.livo.harmony/entry/ets/common/components/AvatarTile";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { FeedSubscribeConfigView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedSubscribeConfigView";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { FeedViewType, formatPublishedAt, toArticleDetailModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, Feed } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { DiscoverRemoteSearchService } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverRemoteSearchService";
import { discoverPlatformLabel, discoverViewLabel, filteredRecommendedFeedsByPlatform, normalizeDiscoverInput, preferredViewForPlatform, resolveKeywordCandidatesByPlatform, resolveProfileCandidatesByPlatform, searchedRecommendedFeedsByPlatform, } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverService";
import type { DiscoverSearchPlatform, RecommendedFeed, ResolvedDiscoverCandidate } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverService";
import type { FeedRefreshPayload } from '../services/RssFeedService';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { FeedDetailView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedDetailView";
import { extractInstagramUsername, extractXUsername } from "@bundle:com.livo.harmony/entry/ets/common/utils/SocialFeedTitles";
import { CARD_RADIUS_LG, CARD_RADIUS_MD, CHIP_FONT_SIZE, CHIP_RADIUS, INPUT_RADIUS, LIST_ACTION_HEIGHT, LIST_ROW_DIVIDER_INSET, LIST_ROW_HORIZONTAL_PADDING, LIST_ROW_META_SIZE, LIST_ROW_TITLE_SIZE, LIST_ROW_VERTICAL_PADDING, PAGE_BOTTOM_GAP, PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING, SECTION_TITLE_FONT_SIZE, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
const DISCOVER_ROUTE_PREVIEW: string = 'discover-preview';
const DISCOVER_ROUTE_SUBSCRIBE_CONFIG: string = 'discover-subscribe-config';
const DISCOVER_ROUTE_ENTRY_DETAIL: string = 'entry-detail';
interface DirectUrlResult {
    targetUrl: string;
    siteUrl: string;
    title: string;
    description: string;
}
class DiscoverFlowRouteParams {
    targetUrl: string = '';
    targetTitle: string = '';
    targetView: FeedViewType = FeedViewType.Articles;
    siteUrl: string = '';
    imageUrl: string = '';
    description: string = '';
    sourceKind: string = '';
    category: string = '';
}
class EntryDetailParams {
    entry: Entry | undefined = undefined;
    feedTitle: string = '';
    feedImageUrl: string = '';
}
interface ConfigOption {
    view: FeedViewType;
    label: string;
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
        imageUrl: feed.imageUrl || '',
        followers: feed.followers || '',
    };
}
function createDiscoverFlowRouteParams(targetUrl: string, targetTitle: string, targetView: FeedViewType, siteUrl: string, imageUrl: string, description: string, sourceKind: string, category: string): DiscoverFlowRouteParams {
    const params = new DiscoverFlowRouteParams();
    params.targetUrl = targetUrl;
    params.targetTitle = targetTitle;
    params.targetView = targetView;
    params.siteUrl = siteUrl;
    params.imageUrl = imageUrl;
    params.description = description;
    params.sourceKind = sourceKind;
    params.category = category;
    return params;
}
function normalizeDiscoverFlowRouteParams(params?: DiscoverFlowRouteParams): DiscoverFlowRouteParams {
    if (params) {
        return params;
    }
    return new DiscoverFlowRouteParams();
}
export class DiscoverContent extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__query = new ObservedPropertySimplePU('', this, "query");
        this.__searchPlatform = new ObservedPropertySimplePU('all', this, "searchPlatform");
        this.__showPlatformChips = new ObservedPropertySimplePU(false, this, "showPlatformChips");
        this.__isInteractingWithPlatformChips = new ObservedPropertySimplePU(false, this, "isInteractingWithPlatformChips");
        this.__keepPlatformChipsOnBlur = new ObservedPropertySimplePU(false, this, "keepPlatformChipsOnBlur");
        this.__isPlatformSwitchSearching = new ObservedPropertySimplePU(false, this, "isPlatformSwitchSearching");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__remoteResults = new ObservedPropertyObjectPU([], this, "remoteResults");
        this.__isSearchingRemote = new ObservedPropertySimplePU(false, this, "isSearchingRemote");
        this.__hasLoaded = new ObservedPropertySimplePU(false, this, "hasLoaded");
        this.__isLoadingPage = new ObservedPropertySimplePU(false, this, "isLoadingPage");
        this.__subscribedFeeds = new ObservedPropertyObjectPU([], this, "subscribedFeeds");
        this.__showBottomTabs = new SynchedPropertySimpleOneWayPU(params.showBottomTabs, this, "showBottomTabs");
        this.__reserveBottomTabInset = new SynchedPropertySimpleOneWayPU(params.reserveBottomTabInset, this, "reserveBottomTabInset");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.__bottomAvoidArea = this.createStorageProp('bottomAvoidArea', 0, "bottomAvoidArea");
        this.__discoverOverlayLevel = this.createStorageProp('discoverOverlayLevel', 0, "discoverOverlayLevel");
        this.__feedsChangedAt = this.createStorageProp('feedsChangedAt', 0, "feedsChangedAt");
        this.__discoverSearchDismissAt = this.createStorageProp('discoverSearchDismissAt', 0, "discoverSearchDismissAt");
        this.__discoverPathStack = new ObservedPropertyObjectPU(new NavPathStack(), this, "discoverPathStack");
        this.addProvidedVar("DiscoverNavPathStack", this.__discoverPathStack, false);
        this.addProvidedVar("discoverPathStack", this.__discoverPathStack, false);
        this.onReady = () => { };
        this.searchSession = 0;
        this.platformSwitchSession = 0;
        this.searchInputController = new TextInputController();
        this.setInitiallyProvidedValue(params);
        this.declareWatch("inheritedTheme", this.syncInheritedTheme);
        this.declareWatch("feedsChangedAt", this.handleFeedsChanged);
        this.declareWatch("discoverSearchDismissAt", this.handleSearchDismissSignal);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverContent_Params) {
        if (params.query !== undefined) {
            this.query = params.query;
        }
        if (params.searchPlatform !== undefined) {
            this.searchPlatform = params.searchPlatform;
        }
        if (params.showPlatformChips !== undefined) {
            this.showPlatformChips = params.showPlatformChips;
        }
        if (params.isInteractingWithPlatformChips !== undefined) {
            this.isInteractingWithPlatformChips = params.isInteractingWithPlatformChips;
        }
        if (params.keepPlatformChipsOnBlur !== undefined) {
            this.keepPlatformChipsOnBlur = params.keepPlatformChipsOnBlur;
        }
        if (params.isPlatformSwitchSearching !== undefined) {
            this.isPlatformSwitchSearching = params.isPlatformSwitchSearching;
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
        if (params.hasLoaded !== undefined) {
            this.hasLoaded = params.hasLoaded;
        }
        if (params.isLoadingPage !== undefined) {
            this.isLoadingPage = params.isLoadingPage;
        }
        if (params.subscribedFeeds !== undefined) {
            this.subscribedFeeds = params.subscribedFeeds;
        }
        if (params.showBottomTabs === undefined) {
            this.__showBottomTabs.set(true);
        }
        if (params.reserveBottomTabInset === undefined) {
            this.__reserveBottomTabInset.set(false);
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
        if (params.discoverPathStack !== undefined) {
            this.discoverPathStack = params.discoverPathStack;
        }
        if (params.onReady !== undefined) {
            this.onReady = params.onReady;
        }
        if (params.searchSession !== undefined) {
            this.searchSession = params.searchSession;
        }
        if (params.platformSwitchSession !== undefined) {
            this.platformSwitchSession = params.platformSwitchSession;
        }
        if (params.searchInputController !== undefined) {
            this.searchInputController = params.searchInputController;
        }
    }
    updateStateVars(params: DiscoverContent_Params) {
        this.__showBottomTabs.reset(params.showBottomTabs);
        this.__reserveBottomTabInset.reset(params.reserveBottomTabInset);
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__query.purgeDependencyOnElmtId(rmElmtId);
        this.__searchPlatform.purgeDependencyOnElmtId(rmElmtId);
        this.__showPlatformChips.purgeDependencyOnElmtId(rmElmtId);
        this.__isInteractingWithPlatformChips.purgeDependencyOnElmtId(rmElmtId);
        this.__keepPlatformChipsOnBlur.purgeDependencyOnElmtId(rmElmtId);
        this.__isPlatformSwitchSearching.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__remoteResults.purgeDependencyOnElmtId(rmElmtId);
        this.__isSearchingRemote.purgeDependencyOnElmtId(rmElmtId);
        this.__hasLoaded.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoadingPage.purgeDependencyOnElmtId(rmElmtId);
        this.__subscribedFeeds.purgeDependencyOnElmtId(rmElmtId);
        this.__showBottomTabs.purgeDependencyOnElmtId(rmElmtId);
        this.__reserveBottomTabInset.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
        this.__bottomAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__feedsChangedAt.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverSearchDismissAt.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverPathStack.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__query.aboutToBeDeleted();
        this.__searchPlatform.aboutToBeDeleted();
        this.__showPlatformChips.aboutToBeDeleted();
        this.__isInteractingWithPlatformChips.aboutToBeDeleted();
        this.__keepPlatformChipsOnBlur.aboutToBeDeleted();
        this.__isPlatformSwitchSearching.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__remoteResults.aboutToBeDeleted();
        this.__isSearchingRemote.aboutToBeDeleted();
        this.__hasLoaded.aboutToBeDeleted();
        this.__isLoadingPage.aboutToBeDeleted();
        this.__subscribedFeeds.aboutToBeDeleted();
        this.__showBottomTabs.aboutToBeDeleted();
        this.__reserveBottomTabInset.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
        this.__bottomAvoidArea.aboutToBeDeleted();
        this.__discoverOverlayLevel.aboutToBeDeleted();
        this.__feedsChangedAt.aboutToBeDeleted();
        this.__discoverSearchDismissAt.aboutToBeDeleted();
        this.__discoverPathStack.aboutToBeDeleted();
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
    private __showPlatformChips: ObservedPropertySimplePU<boolean>;
    get showPlatformChips() {
        return this.__showPlatformChips.get();
    }
    set showPlatformChips(newValue: boolean) {
        this.__showPlatformChips.set(newValue);
    }
    private __isInteractingWithPlatformChips: ObservedPropertySimplePU<boolean>;
    get isInteractingWithPlatformChips() {
        return this.__isInteractingWithPlatformChips.get();
    }
    set isInteractingWithPlatformChips(newValue: boolean) {
        this.__isInteractingWithPlatformChips.set(newValue);
    }
    private __keepPlatformChipsOnBlur: ObservedPropertySimplePU<boolean>;
    get keepPlatformChipsOnBlur() {
        return this.__keepPlatformChipsOnBlur.get();
    }
    set keepPlatformChipsOnBlur(newValue: boolean) {
        this.__keepPlatformChipsOnBlur.set(newValue);
    }
    private __isPlatformSwitchSearching: ObservedPropertySimplePU<boolean>;
    get isPlatformSwitchSearching() {
        return this.__isPlatformSwitchSearching.get();
    }
    set isPlatformSwitchSearching(newValue: boolean) {
        this.__isPlatformSwitchSearching.set(newValue);
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
    private __hasLoaded: ObservedPropertySimplePU<boolean>;
    get hasLoaded() {
        return this.__hasLoaded.get();
    }
    set hasLoaded(newValue: boolean) {
        this.__hasLoaded.set(newValue);
    }
    private __isLoadingPage: ObservedPropertySimplePU<boolean>;
    get isLoadingPage() {
        return this.__isLoadingPage.get();
    }
    set isLoadingPage(newValue: boolean) {
        this.__isLoadingPage.set(newValue);
    }
    private __subscribedFeeds: ObservedPropertyObjectPU<Feed[]>;
    get subscribedFeeds() {
        return this.__subscribedFeeds.get();
    }
    set subscribedFeeds(newValue: Feed[]) {
        this.__subscribedFeeds.set(newValue);
    }
    private __showBottomTabs: SynchedPropertySimpleOneWayPU<boolean>;
    get showBottomTabs() {
        return this.__showBottomTabs.get();
    }
    set showBottomTabs(newValue: boolean) {
        this.__showBottomTabs.set(newValue);
    }
    private __reserveBottomTabInset: SynchedPropertySimpleOneWayPU<boolean>;
    get reserveBottomTabInset() {
        return this.__reserveBottomTabInset.get();
    }
    set reserveBottomTabInset(newValue: boolean) {
        this.__reserveBottomTabInset.set(newValue);
    }
    private __inheritedTheme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get inheritedTheme() {
        return this.__inheritedTheme.get();
    }
    set inheritedTheme(newValue: ThemePalette) {
        this.__inheritedTheme.set(newValue);
    }
    private __bottomAvoidArea: ObservedPropertyAbstractPU<number>;
    get bottomAvoidArea() {
        return this.__bottomAvoidArea.get();
    }
    set bottomAvoidArea(newValue: number) {
        this.__bottomAvoidArea.set(newValue);
    }
    private __discoverOverlayLevel: ObservedPropertyAbstractPU<number>;
    get discoverOverlayLevel() {
        return this.__discoverOverlayLevel.get();
    }
    set discoverOverlayLevel(newValue: number) {
        this.__discoverOverlayLevel.set(newValue);
    }
    private __feedsChangedAt: ObservedPropertyAbstractPU<number>;
    get feedsChangedAt() {
        return this.__feedsChangedAt.get();
    }
    set feedsChangedAt(newValue: number) {
        this.__feedsChangedAt.set(newValue);
    }
    private __discoverSearchDismissAt: ObservedPropertyAbstractPU<number>;
    get discoverSearchDismissAt() {
        return this.__discoverSearchDismissAt.get();
    }
    set discoverSearchDismissAt(newValue: number) {
        this.__discoverSearchDismissAt.set(newValue);
    }
    private __discoverPathStack: ObservedPropertyObjectPU<NavPathStack>;
    get discoverPathStack() {
        return this.__discoverPathStack.get();
    }
    set discoverPathStack(newValue: NavPathStack) {
        this.__discoverPathStack.set(newValue);
    }
    private onReady: () => void;
    private searchSession: number;
    private platformSwitchSession: number;
    private searchInputController: TextInputController;
    aboutToAppear(): void {
        this.dismissSearchFocus();
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
            if (this.hasLoaded || this.isLoadingPage) {
                this.onReady();
                return;
            }
        }
        void this.loadData();
    }
    private async loadData(): Promise<void> {
        if (this.isLoadingPage) {
            return;
        }
        this.isLoadingPage = true;
        try {
            if (this.showBottomTabs) {
                const settings = await AppRepository.settings();
                this.theme = await ThemeService.resolvePalette(settings);
            }
            else {
                this.theme = this.inheritedTheme;
            }
            this.subscribedFeeds = await AppRepository.feedEntities();
            this.hasLoaded = true;
            this.onReady();
        }
        finally {
            this.isLoadingPage = false;
        }
    }
    private syncInheritedTheme(): void {
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
        }
    }
    private viewLabel(view: FeedViewType): string {
        return discoverViewLabel(view);
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
        return searchedRecommendedFeedsByPlatform(this.query, this.searchPlatform)
            .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
            .slice(0, 10);
    }
    private handleSearchDismissSignal(): void {
        this.dismissSearchFocus();
    }
    private dismissSearchFocus(): void {
        this.searchInputController.stopEditing();
        this.showPlatformChips = false;
        this.keepPlatformChipsOnBlur = false;
    }
    private settleDiscoverRootVisible(): void {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
        AppStorage.setOrCreate('discoverOverlayLevel', 0);
    }
    private handleFeedsChanged(): void {
        void this.refreshSubscribedFeeds();
    }
    private async refreshSubscribedFeeds(): Promise<void> {
        this.subscribedFeeds = await AppRepository.feedEntities();
    }
    private searchResults(): ResolvedDiscoverCandidate[] {
        if (this.remoteResults.length > 0) {
            return this.remoteResults;
        }
        return this.localRecommendedResults().map((feed: RecommendedFeed) => createDiscoverResultFromFeed(feed));
    }
    private recommendedFallback(): RecommendedFeed[] {
        return filteredRecommendedFeedsByPlatform(this.searchPlatform)
            .filter((feed: RecommendedFeed) => !this.isSubscribedRecommendedFeed(feed))
            .slice(0, 8);
    }
    private normalizeFeedIdentity(value: string): string {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return '';
        }
        return normalized
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/[?#].*$/, '')
            .replace(/\/+$/, '');
    }
    private pushIdentityKey(keys: string[], value: string): void {
        const trimmed = value.trim();
        if (!trimmed || keys.includes(trimmed)) {
            return;
        }
        keys.push(trimmed);
    }
    private extractBilibiliIdentity(value: string): string {
        const matched = value.match(/\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i);
        return matched?.[1]?.trim() ? `bilibili:${matched[1].trim()}` : '';
    }
    private extractYouTubeIdentity(value: string): string {
        const channelId = value.match(/[?&]channel_id=([^&]+)/i)?.[1]
            || value.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]
            || value.match(/\/channel\/([^/?#]+)/i)?.[1];
        if (channelId?.trim()) {
            return `youtube:channel:${decodeURIComponent(channelId).trim().toLowerCase()}`;
        }
        const handle = value.match(/\/youtube\/user\/(@[^/?#]+)/i)?.[1]
            || value.match(/\/(@[^/?#]+)/i)?.[1];
        if (handle?.trim()) {
            return `youtube:handle:${decodeURIComponent(handle).trim().replace(/^@/, '').toLowerCase()}`;
        }
        const user = value.match(/\/youtube\/user\/([^/?#]+)/i)?.[1]
            || value.match(/\/(?:user|c)\/([^/?#]+)/i)?.[1];
        if (user?.trim()) {
            return `youtube:user:${decodeURIComponent(user).trim().toLowerCase()}`;
        }
        return '';
    }
    private extractCanonicalFeedIdentity(primaryUrl: string, secondaryUrl: string): string {
        const xUsername = extractXUsername(primaryUrl) || extractXUsername(secondaryUrl);
        if (xUsername) {
            return `x:${xUsername}`;
        }
        const instagramUsername = extractInstagramUsername(primaryUrl) || extractInstagramUsername(secondaryUrl);
        if (instagramUsername) {
            return `instagram:${instagramUsername}`;
        }
        const bilibiliIdentity = this.extractBilibiliIdentity(primaryUrl) || this.extractBilibiliIdentity(secondaryUrl);
        if (bilibiliIdentity) {
            return bilibiliIdentity;
        }
        const youTubeIdentity = this.extractYouTubeIdentity(primaryUrl) || this.extractYouTubeIdentity(secondaryUrl);
        if (youTubeIdentity) {
            return youTubeIdentity;
        }
        return '';
    }
    private collectFeedIdentityKeys(url: string, siteUrl: string, title: string): string[] {
        const keys: string[] = [];
        const normalizedUrl = this.normalizeFeedIdentity(url);
        const normalizedSiteUrl = this.normalizeFeedIdentity(siteUrl);
        const normalizedTitle = title.trim().toLowerCase();
        const canonicalIdentity = this.extractCanonicalFeedIdentity(url, siteUrl);
        this.pushIdentityKey(keys, normalizedUrl);
        this.pushIdentityKey(keys, normalizedSiteUrl);
        this.pushIdentityKey(keys, canonicalIdentity);
        this.pushIdentityKey(keys, normalizedTitle);
        return keys;
    }
    private identityKeysOverlap(left: string[], right: string[]): boolean {
        for (const leftKey of left) {
            if (leftKey && right.includes(leftKey)) {
                return true;
            }
        }
        return false;
    }
    private isSubscribedFeedIdentity(url: string, siteUrl: string, title: string): boolean {
        const candidateKeys = this.collectFeedIdentityKeys(url, siteUrl, title);
        for (const subscribedFeed of this.subscribedFeeds) {
            const subscribedKeys = this.collectFeedIdentityKeys(subscribedFeed.url, subscribedFeed.siteUrl ?? '', subscribedFeed.title);
            if (this.identityKeysOverlap(candidateKeys, subscribedKeys)) {
                return true;
            }
            const subscribedUrl = this.normalizeFeedIdentity(subscribedFeed.url);
            const subscribedSiteUrl = this.normalizeFeedIdentity(subscribedFeed.siteUrl ?? '');
            if ((candidateKeys.includes(subscribedUrl) && !!subscribedUrl)
                || (candidateKeys.includes(subscribedSiteUrl) && !!subscribedSiteUrl)) {
                return true;
            }
        }
        return false;
    }
    private isSubscribedRecommendedFeed(feed: RecommendedFeed): boolean {
        return this.isSubscribedFeedIdentity(feed.url, feed.siteUrl, feed.title);
    }
    private isSubscribedCandidate(candidate: ResolvedDiscoverCandidate): boolean {
        return this.isSubscribedFeedIdentity(candidate.targetUrl, candidate.siteUrl, candidate.targetTitle);
    }
    private candidateActionLabel(candidate: ResolvedDiscoverCandidate): string {
        return this.isSubscribedCandidate(candidate) ? '已订阅' : '订阅';
    }
    private candidateActionBackground(candidate: ResolvedDiscoverCandidate): string {
        return this.isSubscribedCandidate(candidate) ? this.theme.elevated : this.theme.accent;
    }
    private candidateActionFontColor(candidate: ResolvedDiscoverCandidate): string {
        return this.isSubscribedCandidate(candidate) ? this.theme.textPrimary : '#FFFFFF';
    }
    private candidateMetaText(candidate: ResolvedDiscoverCandidate): string {
        return (candidate.followers || candidate.description).trim();
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
        this.searchSession += 1;
        const session = this.searchSession;
        if (!trimmed) {
            this.remoteResults = [];
            this.isSearchingRemote = false;
            return;
        }
        if (this.directUrlResult()) {
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
    private async handlePlatformSwitch(platform: DiscoverSearchPlatform): Promise<void> {
        if (this.searchPlatform === platform) {
            return;
        }
        this.searchPlatform = platform;
        this.remoteResults = [];
        if (!this.query.trim()) {
            return;
        }
        this.platformSwitchSession += 1;
        const session = this.platformSwitchSession;
        this.isPlatformSwitchSearching = true;
        await Promise.all([
            this.refreshRemoteResults(),
            new Promise<void>((resolve) => {
                setTimeout(() => resolve(), 220);
            }),
        ]);
        if (this.platformSwitchSession === session) {
            this.isPlatformSwitchSearching = false;
        }
    }
    private openPreviewPage(targetUrl: string, targetTitle: string, targetView: FeedViewType, siteUrl: string, imageUrl: string, description: string, sourceKind: string, category: string): void {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', true);
        AppStorage.setOrCreate('discoverOverlayLevel', 1);
        this.discoverPathStack.pushPathByName(DISCOVER_ROUTE_PREVIEW, createDiscoverFlowRouteParams(targetUrl, targetTitle, targetView, siteUrl, imageUrl, description, sourceKind, category), true);
    }
    private openSubscribeConfigPage(candidate: ResolvedDiscoverCandidate): void {
        this.discoverPathStack.pushPathByName(DISCOVER_ROUTE_SUBSCRIBE_CONFIG, createDiscoverFlowRouteParams(candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl, candidate.imageUrl ?? '', candidate.description, candidate.sourceKind, this.resolvedPlatformLabel(candidate)), true);
    }
    private openDirectUrlResult(result: DirectUrlResult): void {
        this.openPreviewPage(result.targetUrl, result.title, preferredViewForPlatform(this.searchPlatform), result.siteUrl, '', result.description, '地址', discoverPlatformLabel(this.searchPlatform));
    }
    private openCandidate(candidate: ResolvedDiscoverCandidate): void {
        this.openPreviewPage(candidate.targetUrl, candidate.targetTitle, candidate.targetView, candidate.siteUrl, candidate.imageUrl ?? '', candidate.description, candidate.sourceKind, this.resolvedPlatformLabel(candidate));
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
    private PlatformChip(platform: DiscoverSearchPlatform, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(discoverPlatformLabel(platform));
            Context.animation({ duration: 180, curve: Curve.EaseInOut });
            Text.fontSize(CHIP_FONT_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.searchPlatform === platform ? '#FFFFFF' : this.theme.textSecondary);
            Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
            Text.backgroundColor(this.searchPlatform === platform ? this.theme.accent : this.theme.elevated);
            Text.borderRadius(CHIP_RADIUS);
            Context.animation(null);
            Text.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.isInteractingWithPlatformChips = true;
                    return;
                }
                this.isInteractingWithPlatformChips = false;
            });
            Text.onClick(() => {
                void this.handlePlatformSwitch(platform);
            });
        }, Text);
        Text.pop();
    }
    private SearchPanel(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.margin({ bottom: 6 });
            Column.transition(livoMotion.enterSoft(40));
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.width('100%');
            Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
            Row.backgroundColor(this.theme.elevated);
            Row.borderRadius(INPUT_RADIUS);
            Row.border({ width: 0.8, color: this.theme.divider });
            Row.shadow({
                radius: 10,
                color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
                offsetY: 2,
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(20);
            SymbolGlyph.fontColor([this.theme.textSecondary]);
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.query, placeholder: '搜索订阅源', controller: this.searchInputController });
            TextInput.backgroundColor('transparent');
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.placeholderColor(this.theme.textMuted);
            TextInput.caretColor(this.theme.textPrimary);
            TextInput.padding(0);
            TextInput.layoutWeight(1);
            TextInput.onClick(() => {
                this.showPlatformChips = true;
            });
            TextInput.onBlur(() => {
                if (this.keepPlatformChipsOnBlur) {
                    this.keepPlatformChipsOnBlur = false;
                    return;
                }
                setTimeout(() => {
                    if (!this.isInteractingWithPlatformChips) {
                        this.showPlatformChips = false;
                    }
                }, 80);
            });
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
                        Text.borderRadius(CHIP_RADIUS);
                        Text.backgroundColor(this.theme.surface);
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
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Context.animation({ duration: 260, curve: Curve.FastOutSlowIn });
            Column.width('100%');
            Column.height(this.showPlatformChips ? 36 : 0);
            Column.opacity(this.showPlatformChips ? 1 : 0);
            Column.translate({ y: this.showPlatformChips ? 0 : -10 });
            Column.padding({ top: this.showPlatformChips ? 6 : 0 });
            Column.clip(true);
            Context.animation(null);
        }, Column);
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
        Column.pop();
    }
    private SectionHeader(title: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.transition(livoMotion.enterFromRight(20));
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(SECTION_TITLE_FONT_SIZE);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private AvatarBox(imageUrl: string, fallbackLabel: string, accent: string, parent = null) {
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new AvatarTile(this, {
                        imageUrl,
                        fallbackLabel,
                        accent,
                        theme: this.theme,
                        avatarSize: 38,
                        radius: 10,
                        textSize: 14,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 777, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            imageUrl,
                            fallbackLabel,
                            accent,
                            theme: this.theme,
                            avatarSize: 38,
                            radius: 10,
                            textSize: 14
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        imageUrl,
                        fallbackLabel,
                        accent,
                        theme: this.theme,
                        avatarSize: 38,
                        radius: 10,
                        textSize: 14
                    });
                }
            }, { name: "AvatarTile" });
        }
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
                        Row.padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING });
                        Row.backgroundColor(this.theme.surface);
                        Row.borderRadius(CARD_RADIUS_MD);
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
                        Text.fontSize(LIST_ROW_TITLE_SIZE);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                    this.ResultMeta.bind(this)('地址', discoverPlatformLabel(this.searchPlatform), '');
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(result.targetUrl);
                        Text.fontSize(LIST_ROW_META_SIZE);
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
            Row.padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING });
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
            Text.fontSize(LIST_ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.candidateMetaText(candidate));
            Text.fontSize(LIST_ROW_META_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.candidateActionLabel(candidate));
            Button.type(ButtonType.Capsule);
            Button.fontSize(LIST_ROW_META_SIZE);
            Button.fontWeight(FontWeight.Medium);
            Button.height(LIST_ACTION_HEIGHT);
            Button.backgroundColor(this.candidateActionBackground(candidate));
            Button.fontColor(this.candidateActionFontColor(candidate));
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
                        Divider.margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET });
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
                    this.SectionHeader.bind(this)(title);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_LG);
                        Column.border({ width: 0.8, color: this.theme.divider });
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
            if (this.hasSearchResults() || this.isSearchingRemote || this.isPlatformSwitchSearching) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)('搜索结果');
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if ((this.isSearchingRemote || this.isPlatformSwitchSearching) && this.searchResults().length === 0) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 10 });
                                    Row.width('100%');
                                    Row.padding({ left: 16, right: 16, top: 16, bottom: 16 });
                                    Row.backgroundColor(this.theme.surface);
                                    Row.borderRadius(CARD_RADIUS_MD);
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    LoadingProgress.create();
                                    LoadingProgress.width(20);
                                    LoadingProgress.height(20);
                                    LoadingProgress.color(this.theme.accent);
                                }, LoadingProgress);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('搜索中...');
                                    Text.fontSize(LIST_ROW_META_SIZE);
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
                                    Column.borderRadius(CARD_RADIUS_LG);
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
                        Column.create({ space: 8 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.SectionHeader.bind(this)(this.searchPlatform === 'all' ? '推荐订阅' : `${discoverPlatformLabel(this.searchPlatform)} 推荐订阅`);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_LG);
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
            Column.borderRadius(CARD_RADIUS_LG);
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
    private isSearchModeActive(): boolean {
        return !!this.query.trim() || this.isSearchingRemote || this.isPlatformSwitchSearching;
    }
    private SearchModeContent(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.alignItems(HorizontalAlign.Start);
            Column.justifyContent(FlexAlign.Start);
            Column.transition(livoMotion.enterSoft(30));
        }, Column);
        this.SearchResultSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.query.trim() && !this.hasAnyResult() && !this.isSearchingRemote && !this.isPlatformSwitchSearching) {
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
    }
    private DiscoverDefaultContent(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 16 });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.alignItems(HorizontalAlign.Start);
            Column.justifyContent(FlexAlign.Start);
        }, Column);
        this.RecommendedFallbackSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(this.discoverBottomSpacerHeight());
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
    }
    private shouldReserveBottomDock(): boolean {
        if (this.discoverOverlayLevel > 0) {
            return false;
        }
        if (this.showBottomTabs) {
            return true;
        }
        return this.reserveBottomTabInset;
    }
    private discoverListBottomPadding(): number {
        if (this.shouldReserveBottomDock()) {
            return 24;
        }
        return PAGE_BOTTOM_GAP;
    }
    private discoverBottomSpacerHeight(): number {
        if (this.shouldReserveBottomDock()) {
            return 108 + this.bottomAvoidArea;
        }
        return 24;
    }
    private discoverListExternalGap(): number {
        return 0;
    }
    private discoverViewportBottomInset(): number {
        return 0;
    }
    private DiscoverRoot(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
            Stack.onAppear(() => {
                this.dismissSearchFocus();
                this.settleDiscoverRootVisible();
            });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 0 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '添加订阅',
                        theme: this.theme,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1086, col: 11 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '添加订阅',
                            theme: this.theme
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '添加订阅',
                        theme: this.theme
                    });
                }
            }, { name: "PageHeader" });
        }
        this.SearchPanel.bind(this)();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isSearchModeActive()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                        Scroll.backgroundColor(this.theme.background);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                        Scroll.nestedScroll({
                            scrollForward: NestedScrollMode.SELF_FIRST,
                            scrollBackward: NestedScrollMode.SELF_FIRST,
                        });
                        Scroll.onWillScroll((_scrollOffset: number, _scrollSource: ScrollSource, _scrollState: ScrollState) => {
                            this.keepPlatformChipsOnBlur = true;
                            this.searchInputController.stopEditing();
                        });
                        Scroll.padding({
                            left: PAGE_HORIZONTAL_PADDING,
                            right: PAGE_HORIZONTAL_PADDING,
                            top: 6,
                            bottom: 16,
                        });
                    }, Scroll);
                    this.SearchModeContent.bind(this)();
                    Scroll.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                        Scroll.backgroundColor(this.theme.background);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                        Scroll.nestedScroll({
                            scrollForward: NestedScrollMode.SELF_FIRST,
                            scrollBackward: NestedScrollMode.SELF_FIRST,
                        });
                        Scroll.padding({
                            left: PAGE_HORIZONTAL_PADDING,
                            right: PAGE_HORIZONTAL_PADDING,
                            top: 0,
                            bottom: this.discoverListBottomPadding(),
                        });
                        Scroll.margin({ bottom: this.discoverListExternalGap() });
                    }, Scroll);
                    this.DiscoverDefaultContent.bind(this)();
                    Scroll.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showBottomTabs && this.discoverOverlayLevel === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        __Common__.create();
                        __Common__.align(Alignment.Bottom);
                    }, __Common__);
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new BottomTabs(this, { activeTab: 'discover', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1145, col: 9 });
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
                    __Common__.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private DiscoverDestinations(name: string, params?: DiscoverFlowRouteParams | EntryDetailParams, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (name === DISCOVER_ROUTE_PREVIEW) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        NavDestination.create(() => {
                            {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    if (isInitialRender) {
                                        let componentCall = new DiscoverPreviewDestination(this, {
                                            targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                            initialTargetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                            initialTargetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                            initialTargetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                            initialTargetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                            targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                            targetView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                            theme: this.theme,
                                        }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1162, col: 9 });
                                        ViewPU.create(componentCall);
                                        let paramsLambda = () => {
                                            return {
                                                targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                                initialTargetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                                initialTargetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                                initialTargetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                                initialTargetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                                targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                                targetView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                                theme: this.theme
                                            };
                                        };
                                        componentCall.paramsGenerator_ = paramsLambda;
                                    }
                                    else {
                                        this.updateStateVarsOfChildByElmtId(elmtId, {
                                            targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                            initialTargetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                            initialTargetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                            initialTargetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                            initialTargetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                            targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                            targetView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                            theme: this.theme
                                        });
                                    }
                                }, { name: "DiscoverPreviewDestination" });
                            }
                        }, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/DiscoverContent" });
                        NavDestination.hideTitleBar(true);
                    }, NavDestination);
                    NavDestination.pop();
                });
            }
            else if (name === DISCOVER_ROUTE_SUBSCRIBE_CONFIG) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        NavDestination.create(() => {
                            {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    if (isInitialRender) {
                                        let componentCall = new DiscoverSubscribeConfigDestination(this, {
                                            targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                            targetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                            targetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                            targetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                            targetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                            targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                            sourceKind: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).sourceKind,
                                            initialSelectedView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                            theme: this.theme,
                                        }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1176, col: 9 });
                                        ViewPU.create(componentCall);
                                        let paramsLambda = () => {
                                            return {
                                                targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                                targetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                                targetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                                targetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                                targetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                                targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                                sourceKind: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).sourceKind,
                                                initialSelectedView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                                theme: this.theme
                                            };
                                        };
                                        componentCall.paramsGenerator_ = paramsLambda;
                                    }
                                    else {
                                        this.updateStateVarsOfChildByElmtId(elmtId, {
                                            targetUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetUrl,
                                            targetTitle: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetTitle,
                                            targetSiteUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).siteUrl,
                                            targetImageUrl: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).imageUrl,
                                            targetDescription: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).description,
                                            targetCategory: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).category,
                                            sourceKind: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).sourceKind,
                                            initialSelectedView: normalizeDiscoverFlowRouteParams(params as DiscoverFlowRouteParams).targetView,
                                            theme: this.theme
                                        });
                                    }
                                }, { name: "DiscoverSubscribeConfigDestination" });
                            }
                        }, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/DiscoverContent" });
                        NavDestination.hideTitleBar(true);
                    }, NavDestination);
                    NavDestination.pop();
                });
            }
            else if (name === DISCOVER_ROUTE_ENTRY_DETAIL) {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        NavDestination.create(() => {
                            {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    if (isInitialRender) {
                                        let componentCall = new DiscoverEntryDetailDestination(this, {
                                            entry: (params as EntryDetailParams)?.entry,
                                            feedTitle: (params as EntryDetailParams)?.feedTitle ?? '',
                                            feedImageUrl: (params as EntryDetailParams)?.feedImageUrl ?? '',
                                            theme: this.theme,
                                        }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1191, col: 9 });
                                        ViewPU.create(componentCall);
                                        let paramsLambda = () => {
                                            return {
                                                entry: (params as EntryDetailParams)?.entry,
                                                feedTitle: (params as EntryDetailParams)?.feedTitle ?? '',
                                                feedImageUrl: (params as EntryDetailParams)?.feedImageUrl ?? '',
                                                theme: this.theme
                                            };
                                        };
                                        componentCall.paramsGenerator_ = paramsLambda;
                                    }
                                    else {
                                        this.updateStateVarsOfChildByElmtId(elmtId, {
                                            entry: (params as EntryDetailParams)?.entry,
                                            feedTitle: (params as EntryDetailParams)?.feedTitle ?? '',
                                            feedImageUrl: (params as EntryDetailParams)?.feedImageUrl ?? '',
                                            theme: this.theme
                                        });
                                    }
                                }, { name: "DiscoverEntryDetailDestination" });
                            }
                        }, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/DiscoverContent" });
                        NavDestination.hideTitleBar(true);
                    }, NavDestination);
                    NavDestination.pop();
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
            Navigation.create(this.discoverPathStack, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/DiscoverContent", isUserCreateStack: true });
            Navigation.hideToolBar(true);
            Navigation.hideBackButton(true);
            Navigation.mode(NavigationMode.Stack);
            Navigation.navDestination({ builder: this.DiscoverDestinations.bind(this) });
            Navigation.width('100%');
            Navigation.height('100%');
            Navigation.backgroundColor(this.theme.background);
        }, Navigation);
        this.DiscoverRoot.bind(this)();
        Navigation.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
class DiscoverSubscribeConfigDestination extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__discoverPathStack = this.initializeConsume('DiscoverNavPathStack', "discoverPathStack");
        this.__discoverOverlayLevel = this.createStorageProp('discoverOverlayLevel', 0, "discoverOverlayLevel");
        this.__targetUrl = new SynchedPropertySimpleOneWayPU(params.targetUrl, this, "targetUrl");
        this.__targetTitle = new SynchedPropertySimpleOneWayPU(params.targetTitle, this, "targetTitle");
        this.__targetSiteUrl = new SynchedPropertySimpleOneWayPU(params.targetSiteUrl, this, "targetSiteUrl");
        this.__targetImageUrl = new SynchedPropertySimpleOneWayPU(params.targetImageUrl, this, "targetImageUrl");
        this.__targetDescription = new SynchedPropertySimpleOneWayPU(params.targetDescription, this, "targetDescription");
        this.__targetCategory = new SynchedPropertySimpleOneWayPU(params.targetCategory, this, "targetCategory");
        this.__sourceKind = new SynchedPropertySimpleOneWayPU(params.sourceKind, this, "sourceKind");
        this.__initialSelectedView = new SynchedPropertySimpleOneWayPU(params.initialSelectedView, this, "initialSelectedView");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverSubscribeConfigDestination_Params) {
        if (params.targetUrl === undefined) {
            this.__targetUrl.set('');
        }
        if (params.targetTitle === undefined) {
            this.__targetTitle.set('');
        }
        if (params.targetSiteUrl === undefined) {
            this.__targetSiteUrl.set('');
        }
        if (params.targetImageUrl === undefined) {
            this.__targetImageUrl.set('');
        }
        if (params.targetDescription === undefined) {
            this.__targetDescription.set('');
        }
        if (params.targetCategory === undefined) {
            this.__targetCategory.set('');
        }
        if (params.sourceKind === undefined) {
            this.__sourceKind.set('');
        }
        if (params.initialSelectedView === undefined) {
            this.__initialSelectedView.set(FeedViewType.Articles);
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
    }
    updateStateVars(params: DiscoverSubscribeConfigDestination_Params) {
        this.__targetUrl.reset(params.targetUrl);
        this.__targetTitle.reset(params.targetTitle);
        this.__targetSiteUrl.reset(params.targetSiteUrl);
        this.__targetImageUrl.reset(params.targetImageUrl);
        this.__targetDescription.reset(params.targetDescription);
        this.__targetCategory.reset(params.targetCategory);
        this.__sourceKind.reset(params.sourceKind);
        this.__initialSelectedView.reset(params.initialSelectedView);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__discoverPathStack.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__initialSelectedView.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__discoverPathStack.aboutToBeDeleted();
        this.__discoverOverlayLevel.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetImageUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__sourceKind.aboutToBeDeleted();
        this.__initialSelectedView.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __discoverPathStack: ObservedPropertyAbstractPU<NavPathStack>;
    get discoverPathStack() {
        return this.__discoverPathStack.get();
    }
    set discoverPathStack(newValue: NavPathStack) {
        this.__discoverPathStack.set(newValue);
    }
    private __discoverOverlayLevel: ObservedPropertyAbstractPU<number>;
    get discoverOverlayLevel() {
        return this.__discoverOverlayLevel.get();
    }
    set discoverOverlayLevel(newValue: number) {
        this.__discoverOverlayLevel.set(newValue);
    }
    private __targetUrl: SynchedPropertySimpleOneWayPU<string>;
    get targetUrl() {
        return this.__targetUrl.get();
    }
    set targetUrl(newValue: string) {
        this.__targetUrl.set(newValue);
    }
    private __targetTitle: SynchedPropertySimpleOneWayPU<string>;
    get targetTitle() {
        return this.__targetTitle.get();
    }
    set targetTitle(newValue: string) {
        this.__targetTitle.set(newValue);
    }
    private __targetSiteUrl: SynchedPropertySimpleOneWayPU<string>;
    get targetSiteUrl() {
        return this.__targetSiteUrl.get();
    }
    set targetSiteUrl(newValue: string) {
        this.__targetSiteUrl.set(newValue);
    }
    private __targetImageUrl: SynchedPropertySimpleOneWayPU<string>;
    get targetImageUrl() {
        return this.__targetImageUrl.get();
    }
    set targetImageUrl(newValue: string) {
        this.__targetImageUrl.set(newValue);
    }
    private __targetDescription: SynchedPropertySimpleOneWayPU<string>;
    get targetDescription() {
        return this.__targetDescription.get();
    }
    set targetDescription(newValue: string) {
        this.__targetDescription.set(newValue);
    }
    private __targetCategory: SynchedPropertySimpleOneWayPU<string>;
    get targetCategory() {
        return this.__targetCategory.get();
    }
    set targetCategory(newValue: string) {
        this.__targetCategory.set(newValue);
    }
    private __sourceKind: SynchedPropertySimpleOneWayPU<string>;
    get sourceKind() {
        return this.__sourceKind.get();
    }
    set sourceKind(newValue: string) {
        this.__sourceKind.set(newValue);
    }
    private __initialSelectedView: SynchedPropertySimpleOneWayPU<FeedViewType>;
    get initialSelectedView() {
        return this.__initialSelectedView.get();
    }
    set initialSelectedView(newValue: FeedViewType) {
        this.__initialSelectedView.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private settleRootOverlayClosed(): void {
        AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
        AppStorage.setOrCreate('discoverOverlayLevel', 0);
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.onAppear(() => {
                AppStorage.setOrCreate('discoverHasForegroundOverlay', true);
            });
            __Common__.onDisAppear(() => {
                const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0;
                if (currentLevel <= 1) {
                    AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
                }
            });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new FeedSubscribeConfigView(this, {
                        targetUrl: this.targetUrl,
                        targetTitle: this.targetTitle,
                        targetSiteUrl: this.targetSiteUrl,
                        targetImageUrl: this.targetImageUrl,
                        targetDescription: this.targetDescription,
                        targetCategory: this.targetCategory,
                        sourceKind: this.sourceKind,
                        initialSelectedView: this.initialSelectedView,
                        theme: this.theme,
                        onBack: () => {
                            AppStorage.setOrCreate('discoverHasForegroundOverlay', true);
                            AppStorage.setOrCreate('discoverOverlayLevel', 1);
                            this.discoverPathStack.pop(true);
                        },
                        onSubscribed: () => {
                            AppStorage.setOrCreate('discoverSearchDismissAt', Date.now());
                            AppStorage.setOrCreate('feedsChangedAt', Date.now());
                            this.discoverPathStack.clear();
                            this.settleRootOverlayClosed();
                        },
                        onSaved: () => {
                            AppStorage.setOrCreate('feedsChangedAt', Date.now());
                            AppStorage.setOrCreate('discoverOverlayLevel', 1);
                            this.discoverPathStack.pop(true);
                        },
                        onUnsubscribed: () => {
                            AppStorage.setOrCreate('feedsChangedAt', Date.now());
                            this.discoverPathStack.clear();
                            this.settleRootOverlayClosed();
                        }
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1236, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            targetUrl: this.targetUrl,
                            targetTitle: this.targetTitle,
                            targetSiteUrl: this.targetSiteUrl,
                            targetImageUrl: this.targetImageUrl,
                            targetDescription: this.targetDescription,
                            targetCategory: this.targetCategory,
                            sourceKind: this.sourceKind,
                            initialSelectedView: this.initialSelectedView,
                            theme: this.theme,
                            onBack: () => {
                                AppStorage.setOrCreate('discoverHasForegroundOverlay', true);
                                AppStorage.setOrCreate('discoverOverlayLevel', 1);
                                this.discoverPathStack.pop(true);
                            },
                            onSubscribed: () => {
                                AppStorage.setOrCreate('discoverSearchDismissAt', Date.now());
                                AppStorage.setOrCreate('feedsChangedAt', Date.now());
                                this.discoverPathStack.clear();
                                this.settleRootOverlayClosed();
                            },
                            onSaved: () => {
                                AppStorage.setOrCreate('feedsChangedAt', Date.now());
                                AppStorage.setOrCreate('discoverOverlayLevel', 1);
                                this.discoverPathStack.pop(true);
                            },
                            onUnsubscribed: () => {
                                AppStorage.setOrCreate('feedsChangedAt', Date.now());
                                this.discoverPathStack.clear();
                                this.settleRootOverlayClosed();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        targetUrl: this.targetUrl,
                        targetTitle: this.targetTitle,
                        targetSiteUrl: this.targetSiteUrl,
                        targetImageUrl: this.targetImageUrl,
                        targetDescription: this.targetDescription,
                        targetCategory: this.targetCategory,
                        sourceKind: this.sourceKind,
                        initialSelectedView: this.initialSelectedView,
                        theme: this.theme
                    });
                }
            }, { name: "FeedSubscribeConfigView" });
        }
        __Common__.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
class DiscoverPreviewDestination extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__discoverPathStack = this.initializeConsume('DiscoverNavPathStack', "discoverPathStack");
        this.__discoverOverlayLevel = this.createStorageProp('discoverOverlayLevel', 0, "discoverOverlayLevel");
        this.__targetUrl = new SynchedPropertySimpleOneWayPU(params.targetUrl, this, "targetUrl");
        this.__initialTargetTitle = new SynchedPropertySimpleOneWayPU(params.initialTargetTitle, this, "initialTargetTitle");
        this.__initialTargetSiteUrl = new SynchedPropertySimpleOneWayPU(params.initialTargetSiteUrl, this, "initialTargetSiteUrl");
        this.__initialTargetImageUrl = new SynchedPropertySimpleOneWayPU(params.initialTargetImageUrl, this, "initialTargetImageUrl");
        this.__initialTargetDescription = new SynchedPropertySimpleOneWayPU(params.initialTargetDescription, this, "initialTargetDescription");
        this.__targetCategory = new SynchedPropertySimpleOneWayPU(params.targetCategory, this, "targetCategory");
        this.__targetView = new SynchedPropertySimpleOneWayPU(params.targetView, this, "targetView");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverPreviewDestination_Params) {
        if (params.targetUrl === undefined) {
            this.__targetUrl.set('');
        }
        if (params.initialTargetTitle === undefined) {
            this.__initialTargetTitle.set('');
        }
        if (params.initialTargetSiteUrl === undefined) {
            this.__initialTargetSiteUrl.set('');
        }
        if (params.initialTargetImageUrl === undefined) {
            this.__initialTargetImageUrl.set('');
        }
        if (params.initialTargetDescription === undefined) {
            this.__initialTargetDescription.set('');
        }
        if (params.targetCategory === undefined) {
            this.__targetCategory.set('');
        }
        if (params.targetView === undefined) {
            this.__targetView.set(FeedViewType.Articles);
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
    }
    updateStateVars(params: DiscoverPreviewDestination_Params) {
        this.__targetUrl.reset(params.targetUrl);
        this.__initialTargetTitle.reset(params.initialTargetTitle);
        this.__initialTargetSiteUrl.reset(params.initialTargetSiteUrl);
        this.__initialTargetImageUrl.reset(params.initialTargetImageUrl);
        this.__initialTargetDescription.reset(params.initialTargetDescription);
        this.__targetCategory.reset(params.targetCategory);
        this.__targetView.reset(params.targetView);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__discoverPathStack.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__targetView.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__discoverPathStack.aboutToBeDeleted();
        this.__discoverOverlayLevel.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__initialTargetTitle.aboutToBeDeleted();
        this.__initialTargetSiteUrl.aboutToBeDeleted();
        this.__initialTargetImageUrl.aboutToBeDeleted();
        this.__initialTargetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__targetView.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __discoverPathStack: ObservedPropertyAbstractPU<NavPathStack>;
    get discoverPathStack() {
        return this.__discoverPathStack.get();
    }
    set discoverPathStack(newValue: NavPathStack) {
        this.__discoverPathStack.set(newValue);
    }
    private __discoverOverlayLevel: ObservedPropertyAbstractPU<number>;
    get discoverOverlayLevel() {
        return this.__discoverOverlayLevel.get();
    }
    set discoverOverlayLevel(newValue: number) {
        this.__discoverOverlayLevel.set(newValue);
    }
    private __targetUrl: SynchedPropertySimpleOneWayPU<string>;
    get targetUrl() {
        return this.__targetUrl.get();
    }
    set targetUrl(newValue: string) {
        this.__targetUrl.set(newValue);
    }
    private __initialTargetTitle: SynchedPropertySimpleOneWayPU<string>;
    get initialTargetTitle() {
        return this.__initialTargetTitle.get();
    }
    set initialTargetTitle(newValue: string) {
        this.__initialTargetTitle.set(newValue);
    }
    private __initialTargetSiteUrl: SynchedPropertySimpleOneWayPU<string>;
    get initialTargetSiteUrl() {
        return this.__initialTargetSiteUrl.get();
    }
    set initialTargetSiteUrl(newValue: string) {
        this.__initialTargetSiteUrl.set(newValue);
    }
    private __initialTargetImageUrl: SynchedPropertySimpleOneWayPU<string>;
    get initialTargetImageUrl() {
        return this.__initialTargetImageUrl.get();
    }
    set initialTargetImageUrl(newValue: string) {
        this.__initialTargetImageUrl.set(newValue);
    }
    private __initialTargetDescription: SynchedPropertySimpleOneWayPU<string>;
    get initialTargetDescription() {
        return this.__initialTargetDescription.get();
    }
    set initialTargetDescription(newValue: string) {
        this.__initialTargetDescription.set(newValue);
    }
    private __targetCategory: SynchedPropertySimpleOneWayPU<string>;
    get targetCategory() {
        return this.__targetCategory.get();
    }
    set targetCategory(newValue: string) {
        this.__targetCategory.set(newValue);
    }
    private __targetView: SynchedPropertySimpleOneWayPU<FeedViewType>;
    get targetView() {
        return this.__targetView.get();
    }
    set targetView(newValue: FeedViewType) {
        this.__targetView.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private openEditConfigPage(feed: Feed): void {
        AppStorage.setOrCreate('discoverOverlayLevel', 2);
        this.discoverPathStack.pushPathByName(DISCOVER_ROUTE_SUBSCRIBE_CONFIG, createDiscoverFlowRouteParams(this.targetUrl, feed.title, feed.view, feed.siteUrl || this.initialTargetSiteUrl, feed.imageUrl || '', feed.description || this.initialTargetDescription, '编辑', feed.category || ''), true);
    }
    private openNewSubscribeConfigPage(payload: FeedRefreshPayload): void {
        DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload);
        AppStorage.setOrCreate('discoverOverlayLevel', 2);
        this.discoverPathStack.pushPathByName(DISCOVER_ROUTE_SUBSCRIBE_CONFIG, createDiscoverFlowRouteParams(this.targetUrl, payload.feedTitle || this.initialTargetTitle, this.targetView, payload.siteUrl || this.initialTargetSiteUrl, payload.imageUrl || '', payload.description || this.initialTargetDescription, '', this.targetCategory), true);
    }
    private openEntryDetail(entry: Entry): void {
        console.info(`[DiscoverPreview] Opening entry: ${entry.title}`);
        // 构造临时 Feed 以复用完整的 HTML 解析逻辑
        const tempFeed: Feed = {
            id: entry.feedId || 'preview',
            title: '',
            url: entry.url,
            siteUrl: entry.url,
            view: FeedViewType.Articles,
            showInAll: true,
            errorCount: 0,
            createdAt: 0,
            updatedAt: 0,
        };
        const model = toArticleDetailModel(entry, tempFeed);
        void openArticleDetail(entry.id || 'preview', JSON.stringify(model));
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.onAppear(() => {
                AppStorage.setOrCreate('discoverHasForegroundOverlay', true);
            });
            __Common__.onDisAppear(() => {
                const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0;
                if (currentLevel <= 1) {
                    AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
                }
            });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new FeedDetailView(this, {
                        targetUrl: this.targetUrl,
                        initialTargetTitle: this.initialTargetTitle,
                        initialTargetSiteUrl: this.initialTargetSiteUrl,
                        initialTargetImageUrl: this.initialTargetImageUrl,
                        initialTargetDescription: this.initialTargetDescription,
                        targetCategory: this.targetCategory,
                        targetView: this.targetView,
                        theme: this.theme,
                        onBack: () => {
                            AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
                            const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0;
                            AppStorage.setOrCreate('discoverOverlayLevel', currentLevel > 1 ? currentLevel - 1 : 0);
                            this.discoverPathStack.pop(true);
                        },
                        onEdit: (feed: Feed) => { this.openEditConfigPage(feed); },
                        onSubscribe: (payload: FeedRefreshPayload) => { this.openNewSubscribeConfigPage(payload); },
                        onOpenArticle: (entry: Entry, _feed: Feed) => { this.openEntryDetail(entry); }
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1349, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            targetUrl: this.targetUrl,
                            initialTargetTitle: this.initialTargetTitle,
                            initialTargetSiteUrl: this.initialTargetSiteUrl,
                            initialTargetImageUrl: this.initialTargetImageUrl,
                            initialTargetDescription: this.initialTargetDescription,
                            targetCategory: this.targetCategory,
                            targetView: this.targetView,
                            theme: this.theme,
                            onBack: () => {
                                AppStorage.setOrCreate('discoverHasForegroundOverlay', false);
                                const currentLevel = AppStorage.get<number>('discoverOverlayLevel') ?? 0;
                                AppStorage.setOrCreate('discoverOverlayLevel', currentLevel > 1 ? currentLevel - 1 : 0);
                                this.discoverPathStack.pop(true);
                            },
                            onEdit: (feed: Feed) => { this.openEditConfigPage(feed); },
                            onSubscribe: (payload: FeedRefreshPayload) => { this.openNewSubscribeConfigPage(payload); },
                            onOpenArticle: (entry: Entry, _feed: Feed) => { this.openEntryDetail(entry); }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        targetUrl: this.targetUrl,
                        initialTargetTitle: this.initialTargetTitle,
                        initialTargetSiteUrl: this.initialTargetSiteUrl,
                        initialTargetImageUrl: this.initialTargetImageUrl,
                        initialTargetDescription: this.initialTargetDescription,
                        targetCategory: this.targetCategory,
                        targetView: this.targetView,
                        theme: this.theme
                    });
                }
            }, { name: "FeedDetailView" });
        }
        __Common__.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
class DiscoverEntryDetailDestination extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__discoverPathStack = this.initializeConsume('DiscoverNavPathStack', "discoverPathStack");
        this.__entry = new SynchedPropertyObjectOneWayPU(params.entry, this, "entry");
        this.__feedTitle = new SynchedPropertySimpleOneWayPU(params.feedTitle, this, "feedTitle");
        this.__feedImageUrl = new SynchedPropertySimpleOneWayPU(params.feedImageUrl, this, "feedImageUrl");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverEntryDetailDestination_Params) {
        if (params.entry === undefined) {
            this.__entry.set(undefined);
        }
        if (params.feedTitle === undefined) {
            this.__feedTitle.set('');
        }
        if (params.feedImageUrl === undefined) {
            this.__feedImageUrl.set('');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
    }
    updateStateVars(params: DiscoverEntryDetailDestination_Params) {
        this.__entry.reset(params.entry);
        this.__feedTitle.reset(params.feedTitle);
        this.__feedImageUrl.reset(params.feedImageUrl);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__discoverPathStack.purgeDependencyOnElmtId(rmElmtId);
        this.__entry.purgeDependencyOnElmtId(rmElmtId);
        this.__feedTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__feedImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__discoverPathStack.aboutToBeDeleted();
        this.__entry.aboutToBeDeleted();
        this.__feedTitle.aboutToBeDeleted();
        this.__feedImageUrl.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __discoverPathStack: ObservedPropertyAbstractPU<NavPathStack>;
    get discoverPathStack() {
        return this.__discoverPathStack.get();
    }
    set discoverPathStack(newValue: NavPathStack) {
        this.__discoverPathStack.set(newValue);
    }
    private __entry?: SynchedPropertySimpleOneWayPU<Entry>;
    get entry() {
        return this.__entry.get();
    }
    set entry(newValue: Entry) {
        this.__entry.set(newValue);
    }
    private __feedTitle: SynchedPropertySimpleOneWayPU<string>;
    get feedTitle() {
        return this.__feedTitle.get();
    }
    set feedTitle(newValue: string) {
        this.__feedTitle.set(newValue);
    }
    private __feedImageUrl: SynchedPropertySimpleOneWayPU<string>;
    get feedImageUrl() {
        return this.__feedImageUrl.get();
    }
    set feedImageUrl(newValue: string) {
        this.__feedImageUrl.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private publishedLabel(): string {
        return this.entry ? formatPublishedAt(this.entry.publishedAt) : '';
    }
    private HeaderSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
            __Common__.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12, bottom: 10 });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: this.feedTitle || '文章详情',
                        theme: this.theme,
                        showBackButton: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => {
                            this.discoverPathStack.pop(true);
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/DiscoverContent.ets", line: 1397, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: this.feedTitle || '文章详情',
                            theme: this.theme,
                            showBackButton: true,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => {
                                this.discoverPathStack.pop(true);
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: this.feedTitle || '文章详情',
                        theme: this.theme,
                        showBackButton: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
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
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.HeaderSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.entry) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.scrollBar(BarState.Off);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 18 });
                        Column.width('100%');
                        Column.padding({ bottom: 12 });
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
                        Text.create(`${this.entry!.author || '未知作者'} · ${this.publishedLabel()}`);
                        Text.fontSize(13);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
                        Text.width('100%');
                    }, Text);
                    Text.pop();
                    Column.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 20 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding({ left: 18, right: 18, top: 12, bottom: 22 });
                        Column.margin({ top: 4, bottom: 16 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.entry!.summary) {
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
                        if (this.entry!.content) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    ForEach.create();
                                    const forEachItemGenFunction = _item => {
                                        const paragraph = _item;
                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                            If.create();
                                            if (paragraph.trim()) {
                                                this.ifElseBranchUpdateFunction(0, () => {
                                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                        Text.create(paragraph);
                                                        Text.fontSize(16);
                                                        Text.lineHeight(29);
                                                        Text.fontColor(this.theme.textPrimary);
                                                        Text.width('100%');
                                                        Text.textAlign(TextAlign.Start);
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
                                    };
                                    this.forEachUpdateFunction(elmtId, this.entry!.content.split('\n\n'), forEachItemGenFunction, (paragraph: string, index: number) => `${index}-${paragraph}`, false, true);
                                }, ForEach);
                                ForEach.pop();
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
                        if (this.entry!.url) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(`原始来源：${this.entry!.url}`);
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
                        Text.create('无法加载文章内容');
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
}

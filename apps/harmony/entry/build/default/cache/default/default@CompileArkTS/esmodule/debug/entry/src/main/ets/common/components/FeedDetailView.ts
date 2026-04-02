if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface FeedDetailView_Params {
    feedId?: string;
    targetUrl?: string;
    initialTargetTitle?: string;
    initialTargetSiteUrl?: string;
    initialTargetImageUrl?: string;
    initialTargetDescription?: string;
    targetCategory?: string;
    targetView?: FeedViewType;
    theme?: ThemePalette;
    // Callbacks for navigation and actions
    onBack?: () => void;
    onEdit?: (feed: Feed) => void;
    onSubscribe?: (payload: FeedRefreshPayload) => void;
    onOpenArticle?: (entry: Entry, feed: Feed) => void;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetImageUrl?: string;
    targetDescription?: string;
    previewPayload?: FeedRefreshPayload | undefined;
    previewError?: string;
    previewNotice?: string;
    isLoading?: boolean;
    isRefreshing?: boolean;
    existingFeed?: Feed | undefined;
    videoPreviewCache?: VideoPreviewCacheItem[];
    heroAvatarCandidates?: string[];
    heroAvatarIndex?: number;
}
import http from "@ohos:net.http";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { FeedViewType, formatPublishedAt } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, Feed } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { RssFeedService } from "@bundle:com.livo.harmony/entry/ets/common/services/RssFeedService";
import type { FeedRefreshPayload } from "@bundle:com.livo.harmony/entry/ets/common/services/RssFeedService";
import { DiscoverRemoteSearchService } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverRemoteSearchService";
import { isDirectVideoUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/FeedMediaUrl";
import { resolveEntryCardImageUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/EntryCardPreview";
import { SocialFeedAvatarService } from "@bundle:com.livo.harmony/entry/ets/common/services/SocialFeedAvatarService";
import { extractEntryGalleryImageUrls, shouldUseCachedPicturePreview, } from "@bundle:com.livo.harmony/entry/ets/common/utils/PictureGallery";
import { extractInstagramUsername } from "@bundle:com.livo.harmony/entry/ets/common/utils/SocialFeedTitles";
import { resolveSocialFeedDisplayDescription, resolveSocialFeedDisplayImageUrl, resolveSocialFeedDisplayTitle, } from "@bundle:com.livo.harmony/entry/ets/common/utils/SocialFeedPresentation";
import { presentTweetEntryFromEntry } from "@bundle:com.livo.harmony/entry/ets/common/utils/TweetEntryPresentation";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { PictureEntryCard } from "@bundle:com.livo.harmony/entry/ets/common/components/PictureEntryCard";
import { TweetEntryCard } from "@bundle:com.livo.harmony/entry/ets/common/components/TweetEntryCard";
import { PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
interface VideoPreviewCacheItem {
    videoUrl: string;
    previewUrl: string;
}
interface PicturePreviewCardProps {
    entry: Entry;
    index: number;
    authorLabel: string;
    feedImageUrl: string;
    caption: string;
    pictureUrl: string;
    galleryUrls: string[];
    theme: ThemePalette;
    onOpen: () => void;
}
interface DisplayFeedState {
    title: string;
    imageUrl: string;
    description: string;
}
export class FeedDetailView extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__feedId = new SynchedPropertySimpleOneWayPU(params.feedId, this, "feedId");
        this.__targetUrl = new SynchedPropertySimpleOneWayPU(params.targetUrl, this, "targetUrl");
        this.__initialTargetTitle = new SynchedPropertySimpleOneWayPU(params.initialTargetTitle, this, "initialTargetTitle");
        this.__initialTargetSiteUrl = new SynchedPropertySimpleOneWayPU(params.initialTargetSiteUrl, this, "initialTargetSiteUrl");
        this.__initialTargetImageUrl = new SynchedPropertySimpleOneWayPU(params.initialTargetImageUrl, this, "initialTargetImageUrl");
        this.__initialTargetDescription = new SynchedPropertySimpleOneWayPU(params.initialTargetDescription, this, "initialTargetDescription");
        this.__targetCategory = new SynchedPropertySimpleOneWayPU(params.targetCategory, this, "targetCategory");
        this.__targetView = new SynchedPropertySimpleOneWayPU(params.targetView, this, "targetView");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.onBack = () => { };
        this.onEdit = () => { };
        this.onSubscribe = () => { };
        this.onOpenArticle = () => { };
        this.__targetTitle = new ObservedPropertySimplePU('', this, "targetTitle");
        this.__targetSiteUrl = new ObservedPropertySimplePU('', this, "targetSiteUrl");
        this.__targetImageUrl = new ObservedPropertySimplePU('', this, "targetImageUrl");
        this.__targetDescription = new ObservedPropertySimplePU('', this, "targetDescription");
        this.__previewPayload = new ObservedPropertyObjectPU(undefined, this, "previewPayload");
        this.__previewError = new ObservedPropertySimplePU('', this, "previewError");
        this.__previewNotice = new ObservedPropertySimplePU('', this, "previewNotice");
        this.__isLoading = new ObservedPropertySimplePU(true, this, "isLoading");
        this.__isRefreshing = new ObservedPropertySimplePU(false, this, "isRefreshing");
        this.__existingFeed = new ObservedPropertyObjectPU(undefined, this, "existingFeed");
        this.__videoPreviewCache = new ObservedPropertyObjectPU([], this, "videoPreviewCache");
        this.__heroAvatarCandidates = new ObservedPropertyObjectPU([], this, "heroAvatarCandidates");
        this.__heroAvatarIndex = new ObservedPropertySimplePU(0, this, "heroAvatarIndex");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: FeedDetailView_Params) {
        if (params.feedId === undefined) {
            this.__feedId.set('');
        }
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
            this.__theme.set(ThemeService.darkPalette()
            // Callbacks for navigation and actions
            );
        }
        if (params.onBack !== undefined) {
            this.onBack = params.onBack;
        }
        if (params.onEdit !== undefined) {
            this.onEdit = params.onEdit;
        }
        if (params.onSubscribe !== undefined) {
            this.onSubscribe = params.onSubscribe;
        }
        if (params.onOpenArticle !== undefined) {
            this.onOpenArticle = params.onOpenArticle;
        }
        if (params.targetTitle !== undefined) {
            this.targetTitle = params.targetTitle;
        }
        if (params.targetSiteUrl !== undefined) {
            this.targetSiteUrl = params.targetSiteUrl;
        }
        if (params.targetImageUrl !== undefined) {
            this.targetImageUrl = params.targetImageUrl;
        }
        if (params.targetDescription !== undefined) {
            this.targetDescription = params.targetDescription;
        }
        if (params.previewPayload !== undefined) {
            this.previewPayload = params.previewPayload;
        }
        if (params.previewError !== undefined) {
            this.previewError = params.previewError;
        }
        if (params.previewNotice !== undefined) {
            this.previewNotice = params.previewNotice;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
        if (params.isRefreshing !== undefined) {
            this.isRefreshing = params.isRefreshing;
        }
        if (params.existingFeed !== undefined) {
            this.existingFeed = params.existingFeed;
        }
        if (params.videoPreviewCache !== undefined) {
            this.videoPreviewCache = params.videoPreviewCache;
        }
        if (params.heroAvatarCandidates !== undefined) {
            this.heroAvatarCandidates = params.heroAvatarCandidates;
        }
        if (params.heroAvatarIndex !== undefined) {
            this.heroAvatarIndex = params.heroAvatarIndex;
        }
    }
    updateStateVars(params: FeedDetailView_Params) {
        this.__feedId.reset(params.feedId);
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
        this.__feedId.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__initialTargetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__targetView.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__previewPayload.purgeDependencyOnElmtId(rmElmtId);
        this.__previewError.purgeDependencyOnElmtId(rmElmtId);
        this.__previewNotice.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
        this.__isRefreshing.purgeDependencyOnElmtId(rmElmtId);
        this.__existingFeed.purgeDependencyOnElmtId(rmElmtId);
        this.__videoPreviewCache.purgeDependencyOnElmtId(rmElmtId);
        this.__heroAvatarCandidates.purgeDependencyOnElmtId(rmElmtId);
        this.__heroAvatarIndex.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feedId.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__initialTargetTitle.aboutToBeDeleted();
        this.__initialTargetSiteUrl.aboutToBeDeleted();
        this.__initialTargetImageUrl.aboutToBeDeleted();
        this.__initialTargetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__targetView.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetImageUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__previewPayload.aboutToBeDeleted();
        this.__previewError.aboutToBeDeleted();
        this.__previewNotice.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
        this.__isRefreshing.aboutToBeDeleted();
        this.__existingFeed.aboutToBeDeleted();
        this.__videoPreviewCache.aboutToBeDeleted();
        this.__heroAvatarCandidates.aboutToBeDeleted();
        this.__heroAvatarIndex.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __feedId: SynchedPropertySimpleOneWayPU<string>;
    get feedId() {
        return this.__feedId.get();
    }
    set feedId(newValue: string) {
        this.__feedId.set(newValue);
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
    // Callbacks for navigation and actions
    private onBack: () => void;
    private onEdit: (feed: Feed) => void;
    private onSubscribe: (payload: FeedRefreshPayload) => void;
    private onOpenArticle: (entry: Entry, feed: Feed) => void;
    private __targetTitle: ObservedPropertySimplePU<string>;
    get targetTitle() {
        return this.__targetTitle.get();
    }
    set targetTitle(newValue: string) {
        this.__targetTitle.set(newValue);
    }
    private __targetSiteUrl: ObservedPropertySimplePU<string>;
    get targetSiteUrl() {
        return this.__targetSiteUrl.get();
    }
    set targetSiteUrl(newValue: string) {
        this.__targetSiteUrl.set(newValue);
    }
    private __targetImageUrl: ObservedPropertySimplePU<string>;
    get targetImageUrl() {
        return this.__targetImageUrl.get();
    }
    set targetImageUrl(newValue: string) {
        this.__targetImageUrl.set(newValue);
    }
    private __targetDescription: ObservedPropertySimplePU<string>;
    get targetDescription() {
        return this.__targetDescription.get();
    }
    set targetDescription(newValue: string) {
        this.__targetDescription.set(newValue);
    }
    private __previewPayload: ObservedPropertyObjectPU<FeedRefreshPayload | undefined>;
    get previewPayload() {
        return this.__previewPayload.get();
    }
    set previewPayload(newValue: FeedRefreshPayload | undefined) {
        this.__previewPayload.set(newValue);
    }
    private __previewError: ObservedPropertySimplePU<string>;
    get previewError() {
        return this.__previewError.get();
    }
    set previewError(newValue: string) {
        this.__previewError.set(newValue);
    }
    private __previewNotice: ObservedPropertySimplePU<string>;
    get previewNotice() {
        return this.__previewNotice.get();
    }
    set previewNotice(newValue: string) {
        this.__previewNotice.set(newValue);
    }
    private __isLoading: ObservedPropertySimplePU<boolean>;
    get isLoading() {
        return this.__isLoading.get();
    }
    set isLoading(newValue: boolean) {
        this.__isLoading.set(newValue);
    }
    private __isRefreshing: ObservedPropertySimplePU<boolean>;
    get isRefreshing() {
        return this.__isRefreshing.get();
    }
    set isRefreshing(newValue: boolean) {
        this.__isRefreshing.set(newValue);
    }
    private __existingFeed: ObservedPropertyObjectPU<Feed | undefined>;
    get existingFeed() {
        return this.__existingFeed.get();
    }
    set existingFeed(newValue: Feed | undefined) {
        this.__existingFeed.set(newValue);
    }
    private __videoPreviewCache: ObservedPropertyObjectPU<VideoPreviewCacheItem[]>;
    get videoPreviewCache() {
        return this.__videoPreviewCache.get();
    }
    set videoPreviewCache(newValue: VideoPreviewCacheItem[]) {
        this.__videoPreviewCache.set(newValue);
    }
    private __heroAvatarCandidates: ObservedPropertyObjectPU<string[]>;
    get heroAvatarCandidates() {
        return this.__heroAvatarCandidates.get();
    }
    set heroAvatarCandidates(newValue: string[]) {
        this.__heroAvatarCandidates.set(newValue);
    }
    private __heroAvatarIndex: ObservedPropertySimplePU<number>;
    get heroAvatarIndex() {
        return this.__heroAvatarIndex.get();
    }
    set heroAvatarIndex(newValue: number) {
        this.__heroAvatarIndex.set(newValue);
    }
    aboutToAppear(): void {
        this.targetTitle = this.initialTargetTitle;
        this.targetSiteUrl = this.initialTargetSiteUrl;
        this.targetImageUrl = this.initialTargetImageUrl;
        this.targetDescription = this.initialTargetDescription;
        this.resetHeroAvatarCandidates();
        void this.loadData();
    }
    private async loadData(): Promise<void> {
        this.isLoading = true;
        this.previewError = '';
        this.previewNotice = '';
        try {
            if (this.feedId) {
                // Mode: Subscribed Feed
                const feed = await AppRepository.feedEntityById(this.feedId);
                if (feed) {
                    this.existingFeed = feed;
                    const displayFeed = this.displayFeedState(feed.title, feed.imageUrl || '', feed.description || '', feed.url, feed.siteUrl || '');
                    this.targetTitle = displayFeed.title;
                    this.targetSiteUrl = feed.siteUrl || '';
                    this.targetImageUrl = displayFeed.imageUrl;
                    this.targetDescription = displayFeed.description;
                    const entries = await AppRepository.entryEntitiesByFeed(this.feedId);
                    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(feed.url);
                    const shouldReseed = this.shouldReseedFromCachedPreview(entries, cachedPayload);
                    const persistedEntries = shouldReseed
                        ? await this.reseedSubscribedFeedFromCachedPreview(this.feedId, cachedPayload as FeedRefreshPayload)
                        : entries;
                    const previewEntries = this.preferredPreviewEntries(persistedEntries, cachedPayload?.entries ?? []);
                    const payloadTitle = displayFeed.title || cachedPayload?.feedTitle || '';
                    const payloadDescription = displayFeed.description || cachedPayload?.description || '';
                    const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl);
                    this.targetImageUrl = payloadImageUrl;
                    // For the shared view, we'll construct a pseudo-payload
                    this.previewPayload = {
                        etag: feed.etag || '',
                        lastModified: feed.lastModified || '',
                        feedTitle: payloadTitle,
                        siteUrl: feed.siteUrl || cachedPayload?.siteUrl || '',
                        imageUrl: payloadImageUrl,
                        description: payloadDescription,
                        entries: previewEntries,
                    };
                    this.resetHeroAvatarCandidates();
                    await this.hydrateSubscribedAvatar(feed, payloadImageUrl);
                    void this.hydrateVideoPreviews(previewEntries);
                }
            }
            else if (this.targetUrl) {
                // Mode: Discover Preview
                this.existingFeed = await this.findExistingFeed(this.targetUrl, this.targetSiteUrl);
                const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(this.targetUrl);
                if (shouldUseCachedPicturePreview(this.isPicturesPreview(), cachedPayload)) {
                    const resolvedCachedPayload = this.normalizedPreviewPayload(cachedPayload as FeedRefreshPayload, this.targetUrl);
                    DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, resolvedCachedPayload);
                    this.previewPayload = resolvedCachedPayload;
                    this.targetTitle = resolvedCachedPayload.feedTitle || this.targetTitle;
                    this.targetSiteUrl = resolvedCachedPayload.siteUrl || this.targetSiteUrl;
                    this.targetImageUrl = resolvedCachedPayload.imageUrl || this.targetImageUrl;
                    this.targetDescription = resolvedCachedPayload.description || this.targetDescription;
                    this.resetHeroAvatarCandidates();
                    void this.hydrateVideoPreviews(resolvedCachedPayload.entries);
                    if (!this.existingFeed && resolvedCachedPayload.siteUrl) {
                        this.existingFeed = await this.findExistingFeed(this.targetUrl, resolvedCachedPayload.siteUrl);
                    }
                    return;
                }
                try {
                    const payload = this.normalizedPreviewPayload(await RssFeedService.previewFeedUrl(this.targetUrl), this.targetUrl);
                    DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload);
                    this.previewPayload = payload;
                    this.targetTitle = payload.feedTitle || this.targetTitle;
                    this.targetSiteUrl = payload.siteUrl || this.targetSiteUrl;
                    this.targetImageUrl = payload.imageUrl || this.targetImageUrl;
                    this.targetDescription = payload.description || this.targetDescription;
                    this.resetHeroAvatarCandidates();
                    void this.hydrateVideoPreviews(payload.entries);
                    // If it matches an existing entry, update it
                    if (!this.existingFeed && payload.siteUrl) {
                        this.existingFeed = await this.findExistingFeed(this.targetUrl, payload.siteUrl);
                    }
                }
                catch (e) {
                    const fallbackPayload = this.buildFallbackPreviewPayload();
                    if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
                        this.previewPayload = fallbackPayload;
                        this.previewNotice = '暂时无法拉取实时预览，已先展示订阅源信息。订阅后会在“图片”栏目按图片流展示内容。';
                        this.resetHeroAvatarCandidates();
                    }
                    else {
                        throw new Error(e instanceof Error ? e.message : '预览加载失败');
                    }
                }
            }
        }
        catch (e) {
            this.previewError = `加载失败: ${e instanceof Error ? e.message : '未知错误'}`;
        }
        finally {
            this.isLoading = false;
        }
    }
    private async refreshData(): Promise<void> {
        if (this.isRefreshing)
            return;
        this.isRefreshing = true;
        try {
            if (this.existingFeed) {
                await AppRepository.refreshFeed(this.existingFeed.id);
                const refreshedFeed = await AppRepository.feedEntityById(this.existingFeed.id);
                const entries = await AppRepository.entryEntitiesByFeed(this.existingFeed.id);
                if (refreshedFeed) {
                    this.existingFeed = refreshedFeed;
                    const displayFeed = this.displayFeedState(refreshedFeed.title, refreshedFeed.imageUrl || '', refreshedFeed.description || '', refreshedFeed.url, refreshedFeed.siteUrl || '');
                    this.targetTitle = displayFeed.title;
                    this.targetSiteUrl = refreshedFeed.siteUrl || '';
                    this.targetDescription = displayFeed.description;
                    const cachedPayload = DiscoverRemoteSearchService.cachedPreviewPayload(refreshedFeed.url);
                    const previewEntries = this.preferredPreviewEntries(entries, cachedPayload?.entries ?? []);
                    const payloadImageUrl = this.preferredDisplayImageUrl(cachedPayload?.imageUrl || '', displayFeed.imageUrl);
                    this.targetImageUrl = payloadImageUrl;
                    this.previewPayload = {
                        etag: refreshedFeed.etag || '',
                        lastModified: refreshedFeed.lastModified || '',
                        feedTitle: displayFeed.title || this.previewPayload?.feedTitle || '',
                        siteUrl: refreshedFeed.siteUrl || this.previewPayload?.siteUrl || '',
                        imageUrl: payloadImageUrl || this.previewPayload?.imageUrl || '',
                        description: displayFeed.description || this.previewPayload?.description || '',
                        entries: previewEntries,
                    };
                    this.resetHeroAvatarCandidates();
                    await this.hydrateSubscribedAvatar(refreshedFeed, payloadImageUrl);
                    void this.hydrateVideoPreviews(previewEntries);
                    return;
                }
                void this.hydrateVideoPreviews(entries);
            }
            else if (this.targetUrl) {
                try {
                    const payload = this.normalizedPreviewPayload(await RssFeedService.previewFeedUrl(this.targetUrl), this.targetUrl);
                    DiscoverRemoteSearchService.rememberPreviewPayload(this.targetUrl, payload);
                    this.previewPayload = payload;
                    this.previewNotice = '';
                    this.targetTitle = payload.feedTitle || this.targetTitle;
                    this.targetSiteUrl = payload.siteUrl || this.targetSiteUrl;
                    this.targetImageUrl = payload.imageUrl || this.targetImageUrl;
                    this.targetDescription = payload.description || this.targetDescription;
                    this.resetHeroAvatarCandidates();
                    void this.hydrateVideoPreviews(payload.entries);
                }
                catch (e) {
                    const fallbackPayload = this.buildFallbackPreviewPayload();
                    if (this.shouldUseSoftPreviewFallback() && fallbackPayload) {
                        this.previewPayload = fallbackPayload;
                        this.previewNotice = '暂时无法刷新实时预览，已保留订阅源信息。';
                        this.resetHeroAvatarCandidates();
                    }
                    else {
                        throw new Error(e instanceof Error ? e.message : '预览刷新失败');
                    }
                }
            }
        }
        finally {
            this.isRefreshing = false;
        }
    }
    private shouldUseSoftPreviewFallback(): boolean {
        if (this.targetView !== FeedViewType.Pictures) {
            return false;
        }
        return !!(this.targetTitle.trim() || this.targetSiteUrl.trim() || this.targetImageUrl.trim() || this.targetDescription.trim());
    }
    private buildFallbackPreviewPayload(): FeedRefreshPayload | undefined {
        const title = (this.targetTitle || this.initialTargetTitle || '').trim();
        const siteUrl = (this.targetSiteUrl || this.initialTargetSiteUrl || '').trim();
        const imageUrl = (this.targetImageUrl || this.initialTargetImageUrl || this.existingFeed?.imageUrl || '').trim();
        const description = (this.targetDescription || this.initialTargetDescription || '').trim();
        if (!title && !siteUrl && !imageUrl && !description) {
            return undefined;
        }
        return {
            etag: '',
            lastModified: '',
            feedTitle: title || this.targetUrl,
            siteUrl,
            imageUrl,
            description,
            entries: [],
        };
    }
    private displayFeedState(title: string, imageUrl: string, description: string, feedUrl: string, siteUrl: string): DisplayFeedState {
        const displayTitle = resolveSocialFeedDisplayTitle(title, feedUrl, siteUrl);
        return {
            title: displayTitle,
            imageUrl: resolveSocialFeedDisplayImageUrl(imageUrl, feedUrl, siteUrl, displayTitle),
            description: resolveSocialFeedDisplayDescription(description, feedUrl, siteUrl),
        };
    }
    private normalizedPreviewPayload(payload: FeedRefreshPayload, fallbackUrl: string): FeedRefreshPayload {
        const displayFeed = this.displayFeedState(payload.feedTitle, payload.imageUrl || '', payload.description || '', payload.resolvedFeedUrl || fallbackUrl, payload.siteUrl || '');
        return {
            etag: payload.etag,
            lastModified: payload.lastModified,
            feedTitle: displayFeed.title,
            siteUrl: payload.siteUrl || '',
            imageUrl: displayFeed.imageUrl,
            description: displayFeed.description,
            resolvedFeedUrl: payload.resolvedFeedUrl,
            entries: payload.entries,
        };
    }
    private preferredDisplayImageUrl(primaryImageUrl: string, fallbackImageUrl: string): string {
        const primary = (primaryImageUrl || '').trim();
        if (primary) {
            return primary;
        }
        return (fallbackImageUrl || '').trim();
    }
    private async hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void> {
        const resolvedAvatar = await SocialFeedAvatarService.resolveFeedAvatar(feed.url, feed.siteUrl || '', currentImageUrl, feed.imageUrl || '');
        if (!resolvedAvatar || resolvedAvatar === this.targetImageUrl) {
            return;
        }
        this.targetImageUrl = resolvedAvatar;
        if (this.previewPayload) {
            this.previewPayload = {
                etag: this.previewPayload.etag,
                lastModified: this.previewPayload.lastModified,
                feedTitle: this.previewPayload.feedTitle,
                siteUrl: this.previewPayload.siteUrl,
                imageUrl: resolvedAvatar,
                description: this.previewPayload.description,
                resolvedFeedUrl: this.previewPayload.resolvedFeedUrl,
                entries: this.previewPayload.entries,
            };
        }
        this.resetHeroAvatarCandidates();
    }
    private latestPublishedAt(entries: Entry[]): number {
        let latest = 0;
        entries.forEach((entry: Entry) => {
            latest = Math.max(latest, entry.publishedAt || 0);
        });
        return latest;
    }
    private previewRichness(entries: Entry[]): number {
        let score = 0;
        entries.forEach((entry: Entry) => {
            score += 1;
            if ((entry.mediaUrls?.length ?? 0) > 0) {
                score += 2;
            }
            if ((entry.summary || '').trim()) {
                score += 1;
            }
            if ((entry.content || '').trim()) {
                score += 1;
            }
        });
        return score;
    }
    private preferredPreviewEntries(localEntries: Entry[], cachedEntries: Entry[]): Entry[] {
        if (localEntries.length === 0) {
            return cachedEntries;
        }
        if (cachedEntries.length === 0) {
            return localEntries;
        }
        const localLatest = this.latestPublishedAt(localEntries);
        const cachedLatest = this.latestPublishedAt(cachedEntries);
        if (cachedLatest > localLatest) {
            return cachedEntries;
        }
        if (cachedEntries.length > localEntries.length) {
            return cachedEntries;
        }
        if (this.previewRichness(cachedEntries) > this.previewRichness(localEntries)) {
            return cachedEntries;
        }
        return localEntries;
    }
    private shouldReseedFromCachedPreview(localEntries: Entry[], cachedPayload: FeedRefreshPayload | undefined): boolean {
        if (!cachedPayload || (cachedPayload.entries?.length ?? 0) === 0) {
            return false;
        }
        return this.preferredPreviewEntries(localEntries, cachedPayload.entries) === cachedPayload.entries;
    }
    private async reseedSubscribedFeedFromCachedPreview(feedId: string, payload: FeedRefreshPayload): Promise<Entry[]> {
        await AppRepository.seedFeedFromPreview(feedId, payload);
        return AppRepository.entryEntitiesByFeed(feedId);
    }
    private normalizeUrl(value: string): string {
        return value.trim().replace(/\/+$/, '').toLowerCase();
    }
    private feedMatchesTarget(feed: Feed, targetUrl: string, siteUrl: string): boolean {
        const normalizedTarget = this.normalizeUrl(targetUrl);
        const normalizedSite = this.normalizeUrl(siteUrl);
        return this.normalizeUrl(feed.url) === normalizedTarget
            || (!!feed.siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedTarget)
            || (!!siteUrl && this.normalizeUrl(feed.url) === normalizedSite)
            || (!!feed.siteUrl && !!siteUrl && this.normalizeUrl(feed.siteUrl) === normalizedSite);
    }
    private async findExistingFeed(targetUrl: string, siteUrl: string): Promise<Feed | undefined> {
        const feeds = await AppRepository.feedEntities();
        return feeds.find((feed: Feed) => this.feedMatchesTarget(feed, targetUrl, siteUrl));
    }
    private hostOf(value: string): string {
        const matched = value.match(/^https?:\/\/([^/]+)/i);
        return matched?.[1] ? matched[1].replace(/^www\./i, '') : '';
    }
    private dedupeUrls(urls: string[]): string[] {
        const result: string[] = [];
        urls.forEach((url: string) => {
            const trimmed = url.trim();
            if (trimmed && !result.includes(trimmed)) {
                result.push(trimmed);
            }
        });
        return result;
    }
    private buildHeroAvatarCandidates(): string[] {
        const candidates: string[] = [];
        const pushCandidate = (value: string): void => {
            const trimmed = value.trim();
            if (!trimmed) {
                return;
            }
            candidates.push(trimmed);
        };
        pushCandidate(this.previewPayload?.imageUrl || '');
        pushCandidate(this.targetImageUrl);
        const instagramUsername = extractInstagramUsername(this.previewPayload?.resolvedFeedUrl || '')
            || extractInstagramUsername(this.existingFeed?.url || '')
            || extractInstagramUsername(this.previewPayload?.siteUrl || '')
            || extractInstagramUsername(this.existingFeed?.siteUrl || '')
            || extractInstagramUsername(this.targetSiteUrl || this.targetUrl)
            || extractInstagramUsername(this.previewPayload?.feedTitle || this.targetTitle);
        if (instagramUsername) {
            pushCandidate(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`);
            pushCandidate(`https://unavatar.io/${encodeURIComponent(`instagram.com/${instagramUsername}`)}?fallback=false`);
        }
        const host = this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl);
        if (host) {
            pushCandidate(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`);
        }
        return this.dedupeUrls(candidates);
    }
    private resetHeroAvatarCandidates(): void {
        this.heroAvatarCandidates = this.buildHeroAvatarCandidates();
        this.heroAvatarIndex = 0;
    }
    private currentHeroAvatarUrl(): string {
        return this.heroAvatarCandidates[this.heroAvatarIndex] ?? '';
    }
    private advanceHeroAvatar(): void {
        if (this.heroAvatarIndex + 1 < this.heroAvatarCandidates.length) {
            this.heroAvatarIndex += 1;
        }
        else {
            this.heroAvatarIndex = this.heroAvatarCandidates.length;
        }
    }
    private avatarFallback(): string {
        const title = (this.previewPayload?.feedTitle || this.targetTitle || '?').trim();
        return title ? title.substring(0, 1).toUpperCase() : '?';
    }
    private extractYouTubeVideoId(value: string): string {
        const matched = (value || '').match(/(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        return matched?.[1] ?? '';
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
    private normalizeVideoUrl(value: string): string {
        const trimmed = (value || '').trim();
        if (!trimmed) {
            return '';
        }
        if (isDirectVideoUrl(trimmed)) {
            return trimmed;
        }
        const youTubeId = this.extractYouTubeVideoId(trimmed);
        if (youTubeId) {
            return `https://www.youtube.com/watch?v=${youTubeId}`;
        }
        const bilibiliToken = this.extractBilibiliVideoToken(trimmed);
        if (bilibiliToken.startsWith('BV:')) {
            return `https://www.bilibili.com/video/${bilibiliToken.substring(3)}`;
        }
        if (bilibiliToken.startsWith('AV:')) {
            return `https://www.bilibili.com/video/av${bilibiliToken.substring(3)}`;
        }
        return '';
    }
    private entryVideoUrl(entry: Entry): string {
        const directMediaUrl = (entry.mediaUrls ?? []).find((url: string) => isDirectVideoUrl(url));
        if (directMediaUrl) {
            return directMediaUrl;
        }
        const candidates: string[] = [entry.url, entry.content, entry.summary];
        for (const candidate of candidates) {
            const normalized = this.normalizeVideoUrl(candidate || '');
            if (normalized) {
                return normalized;
            }
        }
        const rawContent = `${entry.content || ''}\n${entry.summary || ''}`;
        const matched = rawContent.match(/https?:\/\/[^\s"'<>]+|(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/)[^\s"'<>]+/i)?.[0] ?? '';
        if (!matched) {
            return '';
        }
        return this.normalizeVideoUrl(matched.startsWith('http') ? matched : `https://${matched}`);
    }
    private entryVideoPreviewUrl(entry: Entry): string {
        const videoUrl = this.entryVideoUrl(entry);
        const cached = this.videoPreviewCache.find((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl);
        if (cached?.previewUrl) {
            return cached.previewUrl;
        }
        const youTubeId = this.extractYouTubeVideoId(videoUrl);
        if (youTubeId) {
            return `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`;
        }
        return '';
    }
    private entryVideoSourceLabel(entry: Entry): string {
        const lower = this.entryVideoUrl(entry).toLowerCase();
        if (isDirectVideoUrl(lower)) {
            return '直链';
        }
        if (lower.includes('youtube.com')) {
            return 'YouTube';
        }
        if (lower.includes('bilibili.com')) {
            return 'Bilibili';
        }
        return '';
    }
    private async hydrateVideoPreviews(entries: Entry[]): Promise<void> {
        for (const entry of entries) {
            const videoUrl = this.entryVideoUrl(entry);
            if (!videoUrl || this.entryVideoPreviewUrl(entry)) {
                continue;
            }
            const previewUrl = await this.fetchBilibiliVideoPreviewUrl(videoUrl);
            if (!previewUrl) {
                continue;
            }
            const existingIndex = this.videoPreviewCache.findIndex((item: VideoPreviewCacheItem) => item.videoUrl === videoUrl);
            const nextCache = [...this.videoPreviewCache];
            const item: VideoPreviewCacheItem = { videoUrl, previewUrl };
            if (existingIndex >= 0) {
                nextCache[existingIndex] = item;
            }
            else {
                nextCache.push(item);
            }
            this.videoPreviewCache = nextCache;
        }
    }
    private async fetchBilibiliVideoPreviewUrl(videoUrl: string): Promise<string> {
        if (!videoUrl.toLowerCase().includes('bilibili.com')) {
            return '';
        }
        const bvid = videoUrl.match(/\/video\/(BV[a-zA-Z0-9]+)/i)?.[1] ?? '';
        if (!bvid) {
            return '';
        }
        const request = http.createHttp();
        try {
            const response = await request.request(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, {
                method: http.RequestMethod.GET,
                connectTimeout: 5000,
                readTimeout: 5000,
                header: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': `https://www.bilibili.com/video/${bvid}`,
                    'Origin': 'https://www.bilibili.com',
                },
            });
            if (response.responseCode !== 200) {
                return '';
            }
            const payload = JSON.parse(String(response.result)) as Record<string, Object | string | number>;
            const data = payload['data'] as Record<string, string> | undefined;
            return typeof data?.['pic'] === 'string' ? data['pic'] : '';
        }
        catch (_) {
            return '';
        }
        finally {
            request.destroy();
        }
    }
    private heroDescription(): string {
        return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl;
    }
    private previewEntries(): Entry[] {
        const entries = this.previewPayload?.entries ?? [];
        if (!this.isPicturesPreview()) {
            return entries.slice(0, 50);
        }
        return this.dedupePicturePreviewEntries(entries).slice(0, 50);
    }
    private normalizePreviewText(value: string): string {
        return (value || '')
            .trim()
            .normalize('NFKC')
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }
    private dedupePicturePreviewEntries(entries: Entry[]): Entry[] {
        const deduped = new Map<string, Entry>();
        entries.forEach((entry: Entry) => {
            const galleryUrls = this.entryGalleryUrls(entry);
            const leadImageUrl = galleryUrls[0] || this.entryPictureUrl(entry);
            const normalizedTitle = this.normalizePreviewText(entry.title || this.galleryCaption(entry));
            const normalizedAuthor = this.normalizePreviewText(entry.author);
            const publishedBucket = Math.floor((entry.publishedAt || 0) / (60 * 1000));
            const key = `${normalizedAuthor}|${publishedBucket}|${normalizedTitle}|${leadImageUrl}`;
            const existing = deduped.get(key);
            if (!existing) {
                deduped.set(key, entry);
                return;
            }
            const existingGalleryCount = this.entryGalleryUrls(existing).length;
            const incomingGalleryCount = galleryUrls.length;
            const keepIncoming = incomingGalleryCount > existingGalleryCount
                || (incomingGalleryCount === existingGalleryCount && (entry.publishedAt || 0) >= (existing.publishedAt || 0));
            if (keepIncoming) {
                deduped.set(key, entry);
            }
        });
        return Array.from(deduped.values()).sort((left: Entry, right: Entry) => (right.publishedAt || 0) - (left.publishedAt || 0));
    }
    private isPicturesPreview(): boolean {
        const currentView = this.existingFeed?.view ?? this.targetView;
        return currentView === FeedViewType.Pictures;
    }
    private isXUrl(value: string): boolean {
        const normalized = (value || '').toLowerCase();
        return normalized.includes('x.com/') || normalized.includes('twitter.com/')
            || normalized.includes('/x/user/') || normalized.includes('/twitter/user/');
    }
    private isXPreview(): boolean {
        return this.isXUrl(this.existingFeed?.url || '')
            || this.isXUrl(this.existingFeed?.siteUrl || '')
            || this.isXUrl(this.targetUrl)
            || this.isXUrl(this.targetSiteUrl)
            || this.isXUrl(this.previewPayload?.siteUrl || '');
    }
    private tweetPresentation(entry: Entry) {
        return presentTweetEntryFromEntry(entry, this.resolvedAvatarUrl());
    }
    private entryPictureUrl(entry: Entry): string {
        return resolveEntryCardImageUrl({
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            articleUrl: entry.url,
            siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl,
            mediaUrls: entry.mediaUrls ?? [],
        });
    }
    private entryGalleryUrls(entry: Entry): string[] {
        return extractEntryGalleryImageUrls({
            summary: entry.summary,
            content: entry.content,
            articleUrl: entry.url,
            siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl,
            mediaUrls: entry.mediaUrls ?? [],
        });
    }
    private hasEntryPicture(entry: Entry): boolean {
        return this.entryGalleryUrls(entry).length > 0 || !!this.entryPictureUrl(entry);
    }
    private galleryCaption(entry: Entry): string {
        const title = (entry.title || '').trim();
        if (title && title !== '远程条目') {
            return title;
        }
        return (entry.summary || '').trim();
    }
    private picturePreviewCardProps(entry: Entry, index: number): PicturePreviewCardProps {
        const galleryUrls = this.entryGalleryUrls(entry);
        const pictureUrl = this.entryPictureUrl(entry);
        return {
            entry,
            index,
            authorLabel: entry.author || this.heroTitle() || '未知来源',
            feedImageUrl: this.resolvedAvatarUrl(),
            caption: this.galleryCaption(entry),
            pictureUrl,
            galleryUrls,
            theme: this.theme,
            onOpen: () => {
                this.onOpenArticle(entry, this.articleDetailFeed(entry));
            },
        };
    }
    private articleDetailFeed(entry: Entry): Feed {
        if (this.existingFeed) {
            return this.existingFeed;
        }
        return {
            id: entry.feedId || this.feedId || 'preview',
            title: this.previewPayload?.feedTitle || this.targetTitle || '预览内容',
            url: this.targetUrl || entry.url,
            siteUrl: this.previewPayload?.siteUrl || this.targetSiteUrl || entry.url,
            imageUrl: this.previewPayload?.imageUrl || '',
            description: this.previewPayload?.description || this.targetDescription || '',
            category: this.targetCategory || '未分类',
            view: this.targetView,
            showInAll: true,
            errorCount: 0,
            createdAt: 0,
            updatedAt: 0,
        };
    }
    private resolvedAvatarUrl(): string {
        return this.currentHeroAvatarUrl();
    }
    private heroTitle(): string {
        return this.previewPayload?.feedTitle || this.targetTitle || '订阅详情';
    }
    private heroHostLabel(): string {
        const siteOrTarget = this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl;
        return this.hostOf(siteOrTarget) || siteOrTarget;
    }
    private FeedAvatar(size: number = 32, radius: number = 10, fontSize: number = 14, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.resolvedAvatarUrl()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.resolvedAvatarUrl());
                        Image.width(size);
                        Image.height(size);
                        Image.borderRadius(radius);
                        Image.backgroundColor(this.theme.elevated);
                        Image.objectFit(ImageFit.Cover);
                        Image.onError(() => {
                            this.advanceHeroAvatar();
                        });
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(size);
                        Row.height(size);
                        Row.borderRadius(radius);
                        Row.backgroundColor(this.theme.accent);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.avatarFallback());
                        Text.fontSize(fontSize);
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
    private HeaderSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
            __Common__.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 4 });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: this.previewPayload?.feedTitle || this.targetTitle || '订阅详情',
                        theme: this.theme,
                        showBackButton: true,
                        trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => { this.onBack(); },
                        onTrailingClick: () => {
                            if (this.existingFeed) {
                                this.onEdit(ObservedObject.GetRawObject(this.existingFeed));
                            }
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/FeedDetailView.ets", line: 857, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: this.previewPayload?.feedTitle || this.targetTitle || '订阅详情',
                            theme: this.theme,
                            showBackButton: true,
                            trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => { this.onBack(); },
                            onTrailingClick: () => {
                                if (this.existingFeed) {
                                    this.onEdit(ObservedObject.GetRawObject(this.existingFeed));
                                }
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: this.previewPayload?.feedTitle || this.targetTitle || '订阅详情',
                        theme: this.theme,
                        showBackButton: true,
                        trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
    }
    private HeroCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.width('100%');
            Column.padding({ left: 20, right: 20, top: 24, bottom: 24 });
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(28);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.FeedAvatar.bind(this)(88, 26, 28);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 6 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.heroTitle());
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(2);
            Text.textAlign(TextAlign.Center);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.heroHostLabel()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.heroHostLabel());
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textMuted);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.textAlign(TextAlign.Center);
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
    }
    private DescriptionCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.heroDescription()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 8 });
                        Column.width('100%');
                        Column.padding(16);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(20);
                        Column.alignItems(HorizontalAlign.Start);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('简介');
                        Text.fontSize(14);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.heroDescription());
                        Text.fontSize(14);
                        Text.lineHeight(22);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
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
    private NoticeCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.previewNotice) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 10 });
                        Row.width('100%');
                        Row.padding(14);
                        Row.backgroundColor(this.theme.surface);
                        Row.borderRadius(18);
                        Row.border({ width: 0.8, color: this.theme.divider });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('预览说明');
                        Text.fontSize(12);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.accent);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.previewNotice);
                        Text.layoutWeight(1);
                        Text.fontSize(12);
                        Text.lineHeight(18);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
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
    private EntryCard(entry: Entry, index: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding(14);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(20);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.shadow({
                radius: this.theme.isDark ? 10 : 14,
                color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
                offsetX: 0,
                offsetY: 4,
            });
            Column.alignItems(HorizontalAlign.Start);
            Column.transition(livoMotion.enterSoft(index * 18 + 40));
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => {
                this.onOpenArticle(entry, this.articleDetailFeed(entry));
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.entryVideoPreviewUrl(entry)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.TopStart });
                        Stack.width('100%');
                        Stack.clip(true);
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.entryVideoPreviewUrl(entry));
                        Image.width('100%');
                        Image.height(172);
                        Image.objectFit(ImageFit.Cover);
                        Image.borderRadius(16);
                    }, Image);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entryVideoSourceLabel(entry) || '视频');
                        Text.fontSize(11);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#FFFFFF');
                        Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                        Text.backgroundColor('rgba(17,24,39,0.72)');
                        Text.borderRadius(999);
                        Text.margin({ left: 12, top: 12 });
                    }, Text);
                    Text.pop();
                    Stack.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.author || '未知作者');
            Text.fontSize(11);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.accent);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('·');
            Text.fontSize(11);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(formatPublishedAt(entry.publishedAt));
            Text.fontSize(11);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.title);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.lineHeight(22);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (entry.summary) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.summary);
                        Text.fontSize(13);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(2);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
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
            if (this.entryVideoSourceLabel(entry)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`${this.entryVideoSourceLabel(entry)} 视频源`);
                        Text.fontSize(12);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor(this.theme.accent);
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
    }
    private PreviewSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('内容预览');
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.previewEntries().length} 条`);
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.previewEntries().length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const entry = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                If.create();
                                if (this.isPicturesPreview()) {
                                    this.ifElseBranchUpdateFunction(0, () => {
                                        {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                if (isInitialRender) {
                                                    let componentCall = new PictureEntryCard(this, this.picturePreviewCardProps(entry, index), undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/FeedDetailView.ets", line: 1060, col: 15 });
                                                    ViewPU.create(componentCall);
                                                    let paramsLambda = () => {
                                                        return this.picturePreviewCardProps(entry, index);
                                                    };
                                                    componentCall.paramsGenerator_ = paramsLambda;
                                                }
                                                else {
                                                    this.updateStateVarsOfChildByElmtId(elmtId, {});
                                                }
                                            }, { name: "PictureEntryCard" });
                                        }
                                    });
                                }
                                else if (this.isXPreview()) {
                                    this.ifElseBranchUpdateFunction(1, () => {
                                        {
                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                if (isInitialRender) {
                                                    let componentCall = new TweetEntryCard(this, {
                                                        presentation: this.tweetPresentation(entry),
                                                        theme: this.theme,
                                                        onOpen: () => {
                                                            this.onOpenArticle(entry, this.articleDetailFeed(entry));
                                                        },
                                                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/FeedDetailView.ets", line: 1062, col: 15 });
                                                    ViewPU.create(componentCall);
                                                    let paramsLambda = () => {
                                                        return {
                                                            presentation: this.tweetPresentation(entry),
                                                            theme: this.theme,
                                                            onOpen: () => {
                                                                this.onOpenArticle(entry, this.articleDetailFeed(entry));
                                                            }
                                                        };
                                                    };
                                                    componentCall.paramsGenerator_ = paramsLambda;
                                                }
                                                else {
                                                    this.updateStateVarsOfChildByElmtId(elmtId, {
                                                        presentation: this.tweetPresentation(entry),
                                                        theme: this.theme
                                                    });
                                                }
                                            }, { name: "TweetEntryCard" });
                                        }
                                    });
                                }
                                else {
                                    this.ifElseBranchUpdateFunction(2, () => {
                                        this.EntryCard.bind(this)(entry, index);
                                    });
                                }
                            }, If);
                            If.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.previewEntries(), forEachItemGenFunction, (entry: Entry) => entry.id, true, false);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                });
            }
            else if (this.isPicturesPreview()) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 8 });
                        Column.width('100%');
                        Column.padding(16);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(20);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('图片流预览暂不可用');
                        Text.fontSize(16);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('这个订阅源已识别为图片类来源。当前先展示订阅源信息，订阅后会在“图片”栏目按图片卡片方式展示。');
                        Text.fontSize(13);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 0 });
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.HeaderSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isLoading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        LoadingProgress.create();
                        LoadingProgress.width(42);
                        LoadingProgress.height(42);
                        LoadingProgress.color(this.theme.accent);
                    }, LoadingProgress);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('正在加载预览...');
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else if (this.previewError) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 16 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('预览失败');
                        Text.fontSize(20);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.previewError);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                        Text.textAlign(TextAlign.Center);
                        Text.padding({ left: 32, right: 32 });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel('重试');
                        Button.onClick(() => { void this.loadData(); });
                        Button.backgroundColor(this.theme.accent);
                        Button.fontColor('#FFFFFF');
                    }, Button);
                    Button.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.Bottom });
                        Stack.width('100%');
                        Stack.layoutWeight(1);
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Refresh.create({ refreshing: { value: this.isRefreshing, changeEvent: newValue => { this.isRefreshing = newValue; } } });
                        Refresh.onRefreshing(() => { void this.refreshData(); });
                    }, Refresh);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.height('100%');
                        Scroll.scrollBar(BarState.Off);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 14 });
                        Column.width('100%');
                        Column.padding({ left: 18, right: 18, top: 0, bottom: 24 });
                    }, Column);
                    this.HeroCard.bind(this)();
                    this.DescriptionCard.bind(this)();
                    this.NoticeCard.bind(this)();
                    this.PreviewSection.bind(this)();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.height(100);
                        Row.width('100%');
                    }, Row);
                    Row.pop();
                    Column.pop();
                    Scroll.pop();
                    Refresh.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.previewPayload && !this.existingFeed) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create();
                                    Row.width('100%');
                                    Row.justifyContent(FlexAlign.Center);
                                    Row.padding({ bottom: 24 });
                                    Row.transition(TransitionEffect.move(TransitionEdge.BOTTOM).combine(TransitionEffect.OPACITY));
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Button.createWithLabel('订阅');
                                    Button.type(ButtonType.Capsule);
                                    Button.width('80%');
                                    Button.height(50);
                                    Button.fontSize(16);
                                    Button.fontWeight(FontWeight.Bold);
                                    Button.backgroundColor(this.theme.accent);
                                    Button.fontColor('#FFFFFF');
                                    Button.shadow({ radius: 20, color: 'rgba(0,0,0,0.15)', offsetY: 8 });
                                    Button.onClick(() => {
                                        this.onSubscribe(this.previewPayload!);
                                    });
                                }, Button);
                                Button.pop();
                                Row.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    Stack.pop();
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

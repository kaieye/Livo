if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface FeedSubscribeConfigView_Params {
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetImageUrl?: string;
    targetDescription?: string;
    targetCategory?: string;
    sourceKind?: string;
    initialSelectedView?: FeedViewType;
    theme?: ThemePalette;
    onBack?: () => void;
    onSubscribed?: () => void | Promise<void>;
    onSaved?: () => void | Promise<void>;
    onUnsubscribed?: () => void | Promise<void>;
    selectedView?: FeedViewType;
    customTitle?: string;
    customCategory?: string;
    hideInTimeline?: boolean;
    isEditMode?: boolean;
    hasChanges?: boolean;
    existingFeed?: Feed | undefined;
    railWidth?: number;
    isSubmitting?: boolean;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { FeedViewType } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Feed } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { FeedDraft } from '../repositories/FeedRepository';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { DiscoverRemoteSearchService } from "@bundle:com.livo.harmony/entry/ets/common/services/DiscoverRemoteSearchService";
import { canonicalInstagramFeedUrl } from "@bundle:com.livo.harmony/entry/ets/common/utils/SocialFeedTitles";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { CARD_RADIUS_SM, CHIP_RADIUS, PAGE_HORIZONTAL_PADDING, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
interface ConfigOption {
    view: FeedViewType;
    label: string;
    description: string;
}
export class FeedSubscribeConfigView extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__targetUrl = new SynchedPropertySimpleOneWayPU(params.targetUrl, this, "targetUrl");
        this.__targetTitle = new SynchedPropertySimpleOneWayPU(params.targetTitle, this, "targetTitle");
        this.__targetSiteUrl = new SynchedPropertySimpleOneWayPU(params.targetSiteUrl, this, "targetSiteUrl");
        this.__targetImageUrl = new SynchedPropertySimpleOneWayPU(params.targetImageUrl, this, "targetImageUrl");
        this.__targetDescription = new SynchedPropertySimpleOneWayPU(params.targetDescription, this, "targetDescription");
        this.__targetCategory = new SynchedPropertySimpleOneWayPU(params.targetCategory, this, "targetCategory");
        this.__sourceKind = new SynchedPropertySimpleOneWayPU(params.sourceKind, this, "sourceKind");
        this.__initialSelectedView = new SynchedPropertySimpleOneWayPU(params.initialSelectedView, this, "initialSelectedView");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.onBack = () => { };
        this.onSubscribed = () => { };
        this.onSaved = () => { };
        this.onUnsubscribed = () => { };
        this.__selectedView = new ObservedPropertySimplePU(FeedViewType.Articles, this, "selectedView");
        this.__customTitle = new ObservedPropertySimplePU('', this, "customTitle");
        this.__customCategory = new ObservedPropertySimplePU('', this, "customCategory");
        this.__hideInTimeline = new ObservedPropertySimplePU(false, this, "hideInTimeline");
        this.__isEditMode = new ObservedPropertySimplePU(false, this, "isEditMode");
        this.__hasChanges = new ObservedPropertySimplePU(false, this, "hasChanges");
        this.__existingFeed = new ObservedPropertyObjectPU(undefined, this, "existingFeed");
        this.__railWidth = new ObservedPropertySimplePU(0, this, "railWidth");
        this.__isSubmitting = new ObservedPropertySimplePU(false, this, "isSubmitting");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: FeedSubscribeConfigView_Params) {
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
        if (params.onBack !== undefined) {
            this.onBack = params.onBack;
        }
        if (params.onSubscribed !== undefined) {
            this.onSubscribed = params.onSubscribed;
        }
        if (params.onSaved !== undefined) {
            this.onSaved = params.onSaved;
        }
        if (params.onUnsubscribed !== undefined) {
            this.onUnsubscribed = params.onUnsubscribed;
        }
        if (params.selectedView !== undefined) {
            this.selectedView = params.selectedView;
        }
        if (params.customTitle !== undefined) {
            this.customTitle = params.customTitle;
        }
        if (params.customCategory !== undefined) {
            this.customCategory = params.customCategory;
        }
        if (params.hideInTimeline !== undefined) {
            this.hideInTimeline = params.hideInTimeline;
        }
        if (params.isEditMode !== undefined) {
            this.isEditMode = params.isEditMode;
        }
        if (params.hasChanges !== undefined) {
            this.hasChanges = params.hasChanges;
        }
        if (params.existingFeed !== undefined) {
            this.existingFeed = params.existingFeed;
        }
        if (params.railWidth !== undefined) {
            this.railWidth = params.railWidth;
        }
        if (params.isSubmitting !== undefined) {
            this.isSubmitting = params.isSubmitting;
        }
    }
    updateStateVars(params: FeedSubscribeConfigView_Params) {
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
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__initialSelectedView.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedView.purgeDependencyOnElmtId(rmElmtId);
        this.__customTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__customCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__hideInTimeline.purgeDependencyOnElmtId(rmElmtId);
        this.__isEditMode.purgeDependencyOnElmtId(rmElmtId);
        this.__hasChanges.purgeDependencyOnElmtId(rmElmtId);
        this.__existingFeed.purgeDependencyOnElmtId(rmElmtId);
        this.__railWidth.purgeDependencyOnElmtId(rmElmtId);
        this.__isSubmitting.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetImageUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__sourceKind.aboutToBeDeleted();
        this.__initialSelectedView.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__selectedView.aboutToBeDeleted();
        this.__customTitle.aboutToBeDeleted();
        this.__customCategory.aboutToBeDeleted();
        this.__hideInTimeline.aboutToBeDeleted();
        this.__isEditMode.aboutToBeDeleted();
        this.__hasChanges.aboutToBeDeleted();
        this.__existingFeed.aboutToBeDeleted();
        this.__railWidth.aboutToBeDeleted();
        this.__isSubmitting.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
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
    private onBack: () => void;
    private onSubscribed: () => void | Promise<void>;
    private onSaved: () => void | Promise<void>;
    private onUnsubscribed: () => void | Promise<void>;
    private __selectedView: ObservedPropertySimplePU<FeedViewType>;
    get selectedView() {
        return this.__selectedView.get();
    }
    set selectedView(newValue: FeedViewType) {
        this.__selectedView.set(newValue);
    }
    private __customTitle: ObservedPropertySimplePU<string>;
    get customTitle() {
        return this.__customTitle.get();
    }
    set customTitle(newValue: string) {
        this.__customTitle.set(newValue);
    }
    private __customCategory: ObservedPropertySimplePU<string>;
    get customCategory() {
        return this.__customCategory.get();
    }
    set customCategory(newValue: string) {
        this.__customCategory.set(newValue);
    }
    private __hideInTimeline: ObservedPropertySimplePU<boolean>;
    get hideInTimeline() {
        return this.__hideInTimeline.get();
    }
    set hideInTimeline(newValue: boolean) {
        this.__hideInTimeline.set(newValue);
    }
    private __isEditMode: ObservedPropertySimplePU<boolean>;
    get isEditMode() {
        return this.__isEditMode.get();
    }
    set isEditMode(newValue: boolean) {
        this.__isEditMode.set(newValue);
    }
    private __hasChanges: ObservedPropertySimplePU<boolean>;
    get hasChanges() {
        return this.__hasChanges.get();
    }
    set hasChanges(newValue: boolean) {
        this.__hasChanges.set(newValue);
    }
    private __existingFeed: ObservedPropertyObjectPU<Feed | undefined>;
    get existingFeed() {
        return this.__existingFeed.get();
    }
    set existingFeed(newValue: Feed | undefined) {
        this.__existingFeed.set(newValue);
    }
    private __railWidth: ObservedPropertySimplePU<number>;
    get railWidth() {
        return this.__railWidth.get();
    }
    set railWidth(newValue: number) {
        this.__railWidth.set(newValue);
    }
    private __isSubmitting: ObservedPropertySimplePU<boolean>;
    get isSubmitting() {
        return this.__isSubmitting.get();
    }
    set isSubmitting(newValue: boolean) {
        this.__isSubmitting.set(newValue);
    }
    aboutToAppear(): void {
        this.selectedView = this.initialSelectedView;
        this.customTitle = this.targetTitle;
        this.customCategory = this.targetCategory;
        this.isEditMode = this.sourceKind === '编辑';
        void this.loadExistingFeed();
    }
    private async loadExistingFeed(): Promise<void> {
        const feeds = await AppRepository.feedEntities();
        this.existingFeed = feeds.find((feed: Feed) => this.feedMatchesTarget(feed));
        if (this.existingFeed) {
            this.customTitle = this.existingFeed.title;
            this.customCategory = this.existingFeed.category || '';
            this.selectedView = this.existingFeed.view;
            this.hideInTimeline = !this.existingFeed.showInAll;
        }
    }
    private normalizeUrl(url: string): string {
        return url.trim().replace(/\/+$/, '').toLowerCase();
    }
    private feedMatchesTarget(feed: Feed): boolean {
        const normalizedFeedUrl = this.normalizeUrl(feed.url);
        const normalizedFeedSiteUrl = this.normalizeUrl(feed.siteUrl || '');
        const normalizedTargetUrl = this.normalizeUrl(this.targetUrl);
        const normalizedMappedUrl = this.normalizeUrl(this.mappedTargetUrl());
        const normalizedTargetSiteUrl = this.normalizeUrl(this.targetSiteUrl);
        return normalizedFeedUrl === normalizedMappedUrl
            || (!!normalizedTargetUrl && normalizedFeedUrl === normalizedTargetUrl)
            || (!!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedMappedUrl)
            || (!!normalizedTargetUrl && !!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedTargetUrl)
            || (!!normalizedTargetSiteUrl && normalizedFeedUrl === normalizedTargetSiteUrl)
            || (!!normalizedTargetSiteUrl && !!normalizedFeedSiteUrl && normalizedFeedSiteUrl === normalizedTargetSiteUrl);
    }
    private checkForChanges(): void {
        if (!this.existingFeed) {
            this.hasChanges = false;
            return;
        }
        this.hasChanges =
            this.customTitle !== this.existingFeed.title ||
                this.customCategory !== this.existingFeed.category ||
                this.selectedView !== this.existingFeed.view ||
                this.hideInTimeline !== !this.existingFeed.showInAll;
    }
    private viewOptions(): ConfigOption[] {
        return [
            { view: FeedViewType.Articles, label: '文章', description: '' },
            { view: FeedViewType.SocialMedia, label: '社交', description: '' },
            { view: FeedViewType.Pictures, label: '图片', description: '' },
            { view: FeedViewType.Videos, label: '视频', description: '' },
        ];
    }
    private getViewLabel(view: FeedViewType): string {
        switch (view) {
            case FeedViewType.Articles:
                return '文章';
            case FeedViewType.SocialMedia:
                return '社交';
            case FeedViewType.Pictures:
                return '图片';
            case FeedViewType.Videos:
                return '视频';
            default:
                return '文章';
        }
    }
    private getViewIcon(view: FeedViewType): Resource {
        switch (view) {
            case FeedViewType.Articles:
                return { "id": 16777239, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
            case FeedViewType.SocialMedia:
                return { "id": 16777243, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
            case FeedViewType.Pictures:
                return { "id": 16777241, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
            case FeedViewType.Videos:
                return { "id": 16777245, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
            default:
                return { "id": 16777239, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        }
    }
    private activeTextColor(): string {
        return this.theme.isDark ? '#F5F8FF' : '#14213D';
    }
    private isBilibiliSource(): boolean {
        const site = this.targetSiteUrl.toLowerCase();
        const target = this.targetUrl.toLowerCase();
        return site.includes('space.bilibili.com')
            || site.includes('bilibili.com')
            || target.includes('/bilibili/user/video/')
            || target.includes('/bilibili/user/dynamic/');
    }
    private mappedTargetUrl(): string {
        if (!this.isBilibiliSource()) {
            return this.targetUrl;
        }
        const matched = this.targetUrl.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i);
        const uid = matched?.[1] ?? '';
        if (!uid) {
            return this.targetUrl;
        }
        const instanceMatch = this.targetUrl.match(/^(https?:\/\/[^/]+)/i);
        const instance = instanceMatch?.[1] ?? 'https://rsshub.pseudoyu.com';
        if (this.selectedView === FeedViewType.SocialMedia) {
            return `${instance}/bilibili/user/dynamic/${uid}`;
        }
        if (this.selectedView === FeedViewType.Videos) {
            return `${instance}/bilibili/user/video/${uid}`;
        }
        return this.targetUrl;
    }
    private effectiveSubscribedUrl(targetUrl: string, siteUrl: string): string {
        return canonicalInstagramFeedUrl(targetUrl, siteUrl) || targetUrl;
    }
    private hostOf(url: string): string {
        const matched = url.match(/^https?:\/\/([^/]+)/i);
        return matched?.[1] ? matched[1].replace(/^www\./i, '') : '';
    }
    private faviconUrl(): string {
        if (this.targetImageUrl.trim()) {
            return this.targetImageUrl.trim();
        }
        const host = this.hostOf(this.targetSiteUrl || this.targetUrl);
        return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : '';
    }
    private async runCompletion(action: () => void | Promise<void>, label: string): Promise<void> {
        try {
            await action();
        }
        catch (error) {
            console.error(`${label} completion failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    private async handleUnsubscribe(): Promise<void> {
        if (!this.existingFeed) {
            return;
        }
        try {
            await AppRepository.removeFeed(this.existingFeed.id);
            this.showToast('已取消订阅', 2000);
        }
        catch (e) {
            this.showToast(`取消订阅失败: ${e}`, 3000);
            return;
        }
        await this.runCompletion(this.onUnsubscribed, 'unsubscribe');
    }
    private async handleSave(): Promise<void> {
        if (!this.existingFeed) {
            return;
        }
        try {
            const draft: FeedDraft = {
                url: this.mappedTargetUrl(),
                title: this.customTitle || this.targetTitle,
                siteUrl: this.targetSiteUrl,
                imageUrl: this.targetImageUrl || this.existingFeed?.imageUrl || '',
                description: this.targetDescription,
                category: this.customCategory,
                view: this.selectedView,
                showInAll: !this.hideInTimeline,
            };
            const updatedFeed = await AppRepository.updateFeed(this.existingFeed.id, draft);
            const cachedPreview = DiscoverRemoteSearchService.cachedPreviewPayload(this.mappedTargetUrl());
            if (cachedPreview) {
                await AppRepository.seedFeedFromPreview(updatedFeed.id, cachedPreview);
            }
            const refreshResult = await AppRepository.refreshFeed(updatedFeed.id);
            this.showToast(refreshResult.fallbackUsed ? '保存成功，内容将在稍后刷新' : '保存成功', 2000);
        }
        catch (e) {
            this.showToast(`保存失败: ${e}`, 3000);
            return;
        }
        await this.runCompletion(this.onSaved, 'save');
    }
    private async handleSubscribe(): Promise<void> {
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;
        try {
            const cachedPreview = DiscoverRemoteSearchService.cachedPreviewPayload(this.targetUrl)
                ?? DiscoverRemoteSearchService.cachedPreviewPayload(this.mappedTargetUrl())
                ?? DiscoverRemoteSearchService.cachedPreviewPayload(this.targetSiteUrl);
            const effectiveTargetUrl = this.effectiveSubscribedUrl(cachedPreview?.resolvedFeedUrl?.trim() || this.mappedTargetUrl(), cachedPreview?.siteUrl?.trim() || this.targetSiteUrl.trim());
            const effectiveSiteUrl = cachedPreview?.siteUrl?.trim() || this.targetSiteUrl.trim();
            const latestExistingFeed = this.existingFeed
                ?? await AppRepository.feedEntityByUrl(this.mappedTargetUrl())
                ?? await AppRepository.feedEntityByUrl(effectiveTargetUrl)
                ?? await AppRepository.feedEntityBySiteUrl(effectiveSiteUrl);
            const draft: FeedDraft = {
                url: effectiveTargetUrl,
                title: this.customTitle || cachedPreview?.feedTitle || this.targetTitle,
                siteUrl: effectiveSiteUrl,
                imageUrl: cachedPreview?.imageUrl || this.targetImageUrl || latestExistingFeed?.imageUrl || '',
                description: cachedPreview?.description || this.targetDescription,
                category: this.customCategory,
                view: this.selectedView,
                showInAll: !this.hideInTimeline,
            };
            const hasSeededPreview = !!cachedPreview && (cachedPreview.entries?.length ?? 0) > 0;
            if (latestExistingFeed) {
                const updatedFeed = await AppRepository.updateFeed(latestExistingFeed.id, draft);
                if (cachedPreview) {
                    await AppRepository.seedFeedFromPreview(updatedFeed.id, cachedPreview);
                }
                if (!hasSeededPreview) {
                    const refreshResult = await AppRepository.refreshFeed(updatedFeed.id);
                    this.showToast(refreshResult.fallbackUsed ? '订阅已更新，内容将在稍后刷新' : '订阅已更新', 2000);
                }
                else {
                    this.showToast('订阅已更新', 2000);
                }
            }
            else {
                const createdFeed = await AppRepository.createFeed(draft);
                if (cachedPreview) {
                    await AppRepository.seedFeedFromPreview(createdFeed.id, cachedPreview);
                }
                if (!hasSeededPreview) {
                    const refreshResult = await AppRepository.refreshFeed(createdFeed.id);
                    this.showToast(refreshResult.fallbackUsed ? '订阅成功，内容将在稍后刷新' : '订阅成功', 2000);
                }
                else {
                    this.showToast('订阅成功', 2000);
                }
            }
        }
        catch (e) {
            this.showToast(`订阅失败: ${e}`, 3000);
            this.isSubmitting = false;
            return;
        }
        this.isSubmitting = false;
        await this.runCompletion(this.onSubscribed, 'subscribe');
    }
    private showToast(message: string, duration: number = 2000): void {
        try {
            this.getUIContext().getPromptAction().showToast({
                message,
                duration,
            });
        }
        catch (error) {
            console.error(`showToast failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    private indicatorColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)';
    }
    private indicatorBorderColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)';
    }
    private indicatorShadowColor(): string {
        return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)';
    }
    private viewOptionIndex(view: FeedViewType): number {
        const options = this.viewOptions();
        for (let i = 0; i < options.length; i++) {
            if (options[i].view === view) {
                return i;
            }
        }
        return 0;
    }
    private indicatorSlotWidth(): number {
        if (this.railWidth <= 0) {
            return 0;
        }
        return (this.railWidth - 8) / this.viewOptions().length;
    }
    private indicatorOffsetX(): number {
        return this.indicatorSlotWidth() * this.viewOptionIndex(this.selectedView);
    }
    private TopBar(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
            __Common__.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 12, bottom: 8 });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: `订阅 - ${this.targetTitle}`,
                        theme: this.theme,
                        showBackButton: true,
                        trailingText: this.isEditMode ? '保存' : '订阅',
                        titleSize: 18,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => {
                            this.onBack();
                        },
                        onTrailingClick: () => {
                            if (this.isSubmitting) {
                                return;
                            }
                            if (this.isEditMode) {
                                void this.handleSave();
                                return;
                            }
                            void this.handleSubscribe();
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/FeedSubscribeConfigView.ets", line: 360, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: `订阅 - ${this.targetTitle}`,
                            theme: this.theme,
                            showBackButton: true,
                            trailingText: this.isEditMode ? '保存' : '订阅',
                            titleSize: 18,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => {
                                this.onBack();
                            },
                            onTrailingClick: () => {
                                if (this.isSubmitting) {
                                    return;
                                }
                                if (this.isEditMode) {
                                    void this.handleSave();
                                    return;
                                }
                                void this.handleSubscribe();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: `订阅 - ${this.targetTitle}`,
                        theme: this.theme,
                        showBackButton: true,
                        trailingText: this.isEditMode ? '保存' : '订阅',
                        titleSize: 18,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
    }
    private FeedInfoCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
            Column.padding(16);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(16);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.faviconUrl()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.faviconUrl());
                        Image.width(56);
                        Image.height(56);
                        Image.borderRadius(14);
                        Image.backgroundColor(this.theme.elevated);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(56);
                        Row.height(56);
                        Row.borderRadius(14);
                        Row.backgroundColor(this.theme.accent);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.targetTitle.substring(0, 1).toUpperCase());
                        Text.fontSize(24);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#FFFFFF');
                    }, Text);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 4 });
            Column.alignItems(HorizontalAlign.Start);
            Column.layoutWeight(1);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.targetTitle);
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.targetUrl);
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.targetDescription) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.targetDescription);
                        Text.fontSize(14);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
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
    }
    private ConfigSection(title: string, description: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(description);
            Text.fontSize(13);
            Text.lineHeight(18);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
    }
    private TextInputField(placeholder: string, value: string, onChange: (value: string) => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: value, placeholder: placeholder });
            TextInput.backgroundColor(this.theme.elevated);
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.placeholderColor(this.theme.textMuted);
            TextInput.borderRadius(12);
            TextInput.padding({ left: 16, right: 16, top: 12, bottom: 12 });
            TextInput.width('100%');
            TextInput.onChange((newValue: string) => {
                onChange(newValue);
                this.checkForChanges();
            });
        }, TextInput);
    }
    private ToggleRow(label: string, description: string, value: boolean, onChange: (value: boolean) => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ top: 8, bottom: 8 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 4 });
            Column.alignItems(HorizontalAlign.Start);
            Column.layoutWeight(1);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(description);
            Text.fontSize(12);
            Text.lineHeight(16);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: value });
            Toggle.selectedColor(this.theme.accent);
            Toggle.onChange((isOn: boolean) => {
                onChange(isOn);
                this.checkForChanges();
            });
        }, Toggle);
        Toggle.pop();
        Row.pop();
    }
    private ViewTypeButton(option: ConfigOption, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 6 });
            Context.animation({ duration: 160, curve: Curve.EaseInOut });
            Row.layoutWeight(1);
            Row.height(38);
            Row.justifyContent(FlexAlign.Center);
            Row.borderRadius(CHIP_RADIUS);
            Context.animation(null);
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.onClick(() => {
                this.selectedView = option.view;
                this.checkForChanges();
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Image.create(this.getViewIcon(option.view));
            Image.width(16);
            Image.height(16);
            Image.objectFit(ImageFit.Contain);
        }, Image);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.getViewLabel(option.view));
            Text.fontSize(14);
            Text.fontWeight(this.selectedView === option.view ? FontWeight.Medium : FontWeight.Regular);
            Text.fontColor(this.selectedView === option.view ? this.activeTextColor() : this.theme.textSecondary);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private BottomActions(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isEditMode) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.hasChanges) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create({ space: 12 });
                                    Row.width('90%');
                                    Row.margin({ bottom: 24 });
                                    Row.opacity(0.92);
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Button.createWithLabel('取消订阅');
                                    Button.type(ButtonType.Capsule);
                                    Button.layoutWeight(1);
                                    Button.height(50);
                                    Button.fontSize(16);
                                    Button.fontWeight(FontWeight.Bold);
                                    Button.backgroundColor(this.theme.elevated);
                                    Button.fontColor('#EF4444');
                                    Button.onClick(() => {
                                        this.showUnsubscribeConfirm();
                                    });
                                }, Button);
                                Button.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Button.createWithLabel('保存');
                                    Button.type(ButtonType.Capsule);
                                    Button.layoutWeight(1);
                                    Button.height(50);
                                    Button.fontSize(16);
                                    Button.fontWeight(FontWeight.Bold);
                                    Button.backgroundColor(this.theme.accent);
                                    Button.fontColor('#FFFFFF');
                                    Button.onClick(() => {
                                        void this.handleSave();
                                    });
                                }, Button);
                                Button.pop();
                                Row.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Button.createWithLabel('取消订阅');
                                    Button.type(ButtonType.Capsule);
                                    Button.width('80%');
                                    Button.height(50);
                                    Button.fontSize(16);
                                    Button.fontWeight(FontWeight.Bold);
                                    Button.backgroundColor(this.theme.elevated);
                                    Button.fontColor('#EF4444');
                                    Button.margin({ bottom: 24 });
                                    Button.opacity(0.92);
                                    Button.onClick(() => {
                                        this.showUnsubscribeConfirm();
                                    });
                                }, Button);
                                Button.pop();
                            });
                        }
                    }, If);
                    If.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private showUnsubscribeConfirm(): void {
        this.getUIContext().showAlertDialog({
            title: '取消订阅',
            message: '确定要取消订阅这个订阅源吗？',
            primaryButton: {
                value: '取消',
                action: () => { }
            },
            secondaryButton: {
                value: '确定',
                fontColor: '#EF4444',
                action: () => {
                    void this.handleUnsubscribe();
                }
            }
        });
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.TopBar.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.layoutWeight(1);
            Scroll.scrollBar(BarState.Auto);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 20 });
            Column.width('100%');
            Column.padding({ left: 16, right: 16, top: 8, bottom: 16 });
        }, Column);
        this.FeedInfoCard.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
        }, Column);
        this.ConfigSection.bind(this)('标题', '此订阅源的自定义标题，留空则使用默认标题。');
        this.TextInputField.bind(this)('', this.customTitle, (value: string) => {
            this.customTitle = value;
        });
        Column.pop();
        this.ToggleRow.bind(this)('在时间线中隐藏', '开启后，此订阅将不再显示在主时间线中。', this.hideInTimeline, (value: boolean) => {
            this.hideInTimeline = value;
        });
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
        }, Column);
        this.ConfigSection.bind(this)('栏目', '');
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.width('100%');
            Stack.height(46);
            Stack.padding(4);
            Stack.backgroundColor(this.theme.elevated);
            Stack.borderRadius(CARD_RADIUS_SM);
            Stack.border({ width: 0.8, color: this.theme.divider });
            Stack.onSizeChange((_, newValue) => {
                if (typeof newValue.width === 'number') {
                    this.railWidth = newValue.width;
                }
            });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height('100%');
            Row.justifyContent(FlexAlign.Start);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Context.animation({ duration: 100, curve: Curve.EaseOut });
            Row.width(this.indicatorSlotWidth());
            Row.height(38);
            Row.translate({ x: this.indicatorOffsetX() });
            Row.backgroundColor(this.indicatorColor());
            Row.borderRadius(CHIP_RADIUS);
            Row.border({ width: 0.6, color: this.indicatorBorderColor() });
            Row.shadow({
                radius: 8,
                color: this.indicatorShadowColor(),
                offsetX: 0,
                offsetY: 2,
            });
            Context.animation(null);
            Row.hitTestBehavior(HitTestMode.None);
        }, Row);
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 0 });
            Row.width('100%');
            Row.height('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const option = _item;
                this.ViewTypeButton.bind(this)(option);
            };
            this.forEachUpdateFunction(elmtId, this.viewOptions(), forEachItemGenFunction, (option: ConfigOption) => `view-${option.view}`, false, false);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Stack.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(this.isEditMode ? 80 : 20);
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
        Column.pop();
        this.BottomActions.bind(this)();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

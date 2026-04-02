if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface DiscoverPreview_Params {
    theme?: ThemePalette;
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetDescription?: string;
    targetCategory?: string;
    targetView?: FeedViewType;
    sourceKind?: string;
    previewPayload?: FeedRefreshPayload | undefined;
    previewError?: string;
    isLoading?: boolean;
    isSubmitting?: boolean;
    existingFeed?: Feed | undefined;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { getStringParams, goBack } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { FeedViewType, formatPublishedAt } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, Feed } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { FeedDraft } from '../common/repositories/FeedRepository';
import { RssFeedService } from "@bundle:com.livo.harmony/entry/ets/common/services/RssFeedService";
import type { FeedRefreshPayload } from "@bundle:com.livo.harmony/entry/ets/common/services/RssFeedService";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { PAGE_HORIZONTAL_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
class DiscoverPreview extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.lightPalette(), this, "theme");
        this.__targetUrl = new ObservedPropertySimplePU('', this, "targetUrl");
        this.__targetTitle = new ObservedPropertySimplePU('', this, "targetTitle");
        this.__targetSiteUrl = new ObservedPropertySimplePU('', this, "targetSiteUrl");
        this.__targetDescription = new ObservedPropertySimplePU('', this, "targetDescription");
        this.__targetCategory = new ObservedPropertySimplePU('', this, "targetCategory");
        this.__targetView = new ObservedPropertySimplePU(FeedViewType.Articles, this, "targetView");
        this.__sourceKind = new ObservedPropertySimplePU('', this, "sourceKind");
        this.__previewPayload = new ObservedPropertyObjectPU(undefined, this, "previewPayload");
        this.__previewError = new ObservedPropertySimplePU('', this, "previewError");
        this.__isLoading = new ObservedPropertySimplePU(true, this, "isLoading");
        this.__isSubmitting = new ObservedPropertySimplePU(false, this, "isSubmitting");
        this.__existingFeed = new ObservedPropertyObjectPU(undefined, this, "existingFeed");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverPreview_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.targetUrl !== undefined) {
            this.targetUrl = params.targetUrl;
        }
        if (params.targetTitle !== undefined) {
            this.targetTitle = params.targetTitle;
        }
        if (params.targetSiteUrl !== undefined) {
            this.targetSiteUrl = params.targetSiteUrl;
        }
        if (params.targetDescription !== undefined) {
            this.targetDescription = params.targetDescription;
        }
        if (params.targetCategory !== undefined) {
            this.targetCategory = params.targetCategory;
        }
        if (params.targetView !== undefined) {
            this.targetView = params.targetView;
        }
        if (params.sourceKind !== undefined) {
            this.sourceKind = params.sourceKind;
        }
        if (params.previewPayload !== undefined) {
            this.previewPayload = params.previewPayload;
        }
        if (params.previewError !== undefined) {
            this.previewError = params.previewError;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
        if (params.isSubmitting !== undefined) {
            this.isSubmitting = params.isSubmitting;
        }
        if (params.existingFeed !== undefined) {
            this.existingFeed = params.existingFeed;
        }
    }
    updateStateVars(params: DiscoverPreview_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__targetView.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__previewPayload.purgeDependencyOnElmtId(rmElmtId);
        this.__previewError.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
        this.__isSubmitting.purgeDependencyOnElmtId(rmElmtId);
        this.__existingFeed.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__targetView.aboutToBeDeleted();
        this.__sourceKind.aboutToBeDeleted();
        this.__previewPayload.aboutToBeDeleted();
        this.__previewError.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
        this.__isSubmitting.aboutToBeDeleted();
        this.__existingFeed.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __targetUrl: ObservedPropertySimplePU<string>;
    get targetUrl() {
        return this.__targetUrl.get();
    }
    set targetUrl(newValue: string) {
        this.__targetUrl.set(newValue);
    }
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
    private __targetDescription: ObservedPropertySimplePU<string>;
    get targetDescription() {
        return this.__targetDescription.get();
    }
    set targetDescription(newValue: string) {
        this.__targetDescription.set(newValue);
    }
    private __targetCategory: ObservedPropertySimplePU<string>;
    get targetCategory() {
        return this.__targetCategory.get();
    }
    set targetCategory(newValue: string) {
        this.__targetCategory.set(newValue);
    }
    private __targetView: ObservedPropertySimplePU<FeedViewType>;
    get targetView() {
        return this.__targetView.get();
    }
    set targetView(newValue: FeedViewType) {
        this.__targetView.set(newValue);
    }
    private __sourceKind: ObservedPropertySimplePU<string>;
    get sourceKind() {
        return this.__sourceKind.get();
    }
    set sourceKind(newValue: string) {
        this.__sourceKind.set(newValue);
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
    private __isLoading: ObservedPropertySimplePU<boolean>;
    get isLoading() {
        return this.__isLoading.get();
    }
    set isLoading(newValue: boolean) {
        this.__isLoading.set(newValue);
    }
    private __isSubmitting: ObservedPropertySimplePU<boolean>;
    get isSubmitting() {
        return this.__isSubmitting.get();
    }
    set isSubmitting(newValue: boolean) {
        this.__isSubmitting.set(newValue);
    }
    private __existingFeed: ObservedPropertyObjectPU<Feed | undefined>;
    get existingFeed() {
        return this.__existingFeed.get();
    }
    set existingFeed(newValue: Feed | undefined) {
        this.__existingFeed.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadPage();
    }
    private params(): Record<string, string> {
        return getStringParams();
    }
    private viewLabel(view: FeedViewType): string {
        switch (view) {
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
    private hostOf(value: string): string {
        const matched = value.match(/^https?:\/\/([^/]+)/i);
        return matched?.[1] ? matched[1].replace(/^www\./i, '') : '';
    }
    private avatarFallback(): string {
        const title = (this.previewPayload?.feedTitle || this.targetTitle || '?').trim();
        return title ? title.substring(0, 1).toUpperCase() : '?';
    }
    private heroDescription(): string {
        return this.previewPayload?.description || this.targetDescription || this.previewPayload?.siteUrl || this.targetSiteUrl;
    }
    private previewEntries(): Entry[] {
        return this.previewPayload?.entries.slice(0, 6) ?? [];
    }
    private publishedLabel(entry: Entry): string {
        return formatPublishedAt(entry.publishedAt);
    }
    private resolvedAvatarUrl(): string {
        if (this.previewPayload?.imageUrl) {
            return this.previewPayload.imageUrl;
        }
        const host = this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl);
        if (host) {
            return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
        }
        return '';
    }
    private FeedAvatar(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.resolvedAvatarUrl()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.resolvedAvatarUrl());
                        Image.width(56);
                        Image.height(56);
                        Image.borderRadius(18);
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
                        Row.borderRadius(18);
                        Row.backgroundColor(this.theme.accent);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.avatarFallback());
                        Text.fontSize(22);
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
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: this.previewPayload?.feedTitle || this.targetTitle || '订阅预览',
                        theme: this.theme,
                        showBackButton: true,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                        onBack: () => { void goBack(); },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/DiscoverPreview.ets", line: 108, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: this.previewPayload?.feedTitle || this.targetTitle || '订阅预览',
                            theme: this.theme,
                            showBackButton: true,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0,
                            onBack: () => { void goBack(); }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: this.previewPayload?.feedTitle || this.targetTitle || '订阅预览',
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
    private HeroCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.width('100%');
            Column.padding(20);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(28);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 14 });
            Row.width('100%');
        }, Row);
        this.FeedAvatar.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 6 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.previewPayload?.feedTitle || this.targetTitle);
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.hostOf(this.previewPayload?.siteUrl || this.targetSiteUrl || this.targetUrl));
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
            Text.maxLines(1);
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.heroDescription()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.heroDescription());
                        Text.fontSize(15);
                        Text.lineHeight(24);
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
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const entry = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create({ space: 8 });
                    Column.width('100%');
                    Column.padding(16);
                    Column.backgroundColor(this.theme.surface);
                    Column.borderRadius(22);
                    Column.alignItems(HorizontalAlign.Start);
                }, Column);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create({ space: 8 });
                    Row.width('100%');
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(entry.author || '未知作者');
                    Text.fontSize(11);
                    Text.fontColor(this.theme.textMuted);
                    Text.maxLines(1);
                    Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Blank.create();
                }, Blank);
                Blank.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(this.publishedLabel(entry));
                    Text.fontSize(11);
                    Text.fontColor(this.theme.textMuted);
                }, Text);
                Text.pop();
                Row.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(entry.title);
                    Text.fontSize(17);
                    Text.fontWeight(FontWeight.Bold);
                    Text.fontColor(this.theme.textPrimary);
                    Text.maxLines(2);
                    Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(entry.summary);
                    Text.fontSize(13);
                    Text.lineHeight(21);
                    Text.fontColor(this.theme.textSecondary);
                    Text.maxLines(2);
                    Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                }, Text);
                Text.pop();
                Column.pop();
            };
            this.forEachUpdateFunction(elmtId, this.previewEntries(), forEachItemGenFunction, (entry: Entry) => entry.id, false, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
        Column.pop();
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
    private async loadPage(): Promise<void> {
        this.isLoading = true;
        this.previewError = '';
        this.previewPayload = undefined;
        this.existingFeed = undefined;
        try {
            const settings = await AppRepository.settings();
            this.theme = await ThemeService.resolvePalette(settings);
            const params = this.params();
            this.targetUrl = params.targetUrl ?? '';
            this.targetTitle = params.targetTitle ?? '';
            this.targetSiteUrl = params.siteUrl ?? '';
            this.targetDescription = params.description ?? '';
            this.targetCategory = params.category ?? '';
            this.sourceKind = params.sourceKind ?? '';
            const parsedView = Number(params.view ?? FeedViewType.Articles);
            this.targetView = parsedView as FeedViewType;
            if (!this.targetUrl) {
                this.previewError = '订阅源参数缺失';
                return;
            }
            const payload = await RssFeedService.previewFeedUrl(this.targetUrl);
            this.previewPayload = payload;
            this.existingFeed = await this.findExistingFeed(this.targetUrl, payload.siteUrl);
            if (!this.targetTitle) {
                this.targetTitle = payload.feedTitle;
            }
            if (!this.targetSiteUrl) {
                this.targetSiteUrl = payload.siteUrl;
            }
            if (!this.targetDescription) {
                this.targetDescription = payload.description;
            }
        }
        catch (e) {
            this.previewError = e instanceof Error ? e.message : '预览失败';
        }
        finally {
            this.isLoading = false;
        }
    }
    private async submit(): Promise<void> {
        if (!this.previewPayload || !this.targetUrl) {
            return;
        }
        this.isSubmitting = true;
        try {
            const draft: FeedDraft = {
                title: this.previewPayload.feedTitle || this.targetTitle || this.targetUrl,
                url: this.targetUrl,
                siteUrl: this.previewPayload.siteUrl || this.targetSiteUrl,
                imageUrl: this.previewPayload.imageUrl || this.existingFeed?.imageUrl || '',
                description: this.previewPayload.description || this.targetDescription,
                category: this.targetCategory || this.viewLabel(this.targetView),
                view: this.targetView,
                showInAll: this.existingFeed ? this.existingFeed.showInAll : true,
            };
            if (this.existingFeed) {
                await AppRepository.updateFeed(this.existingFeed.id, draft);
                await AppRepository.refreshFeed(this.existingFeed.id);
                this.showToast('订阅已更新');
            }
            else {
                const created = await AppRepository.createFeed(draft);
                await AppRepository.refreshFeed(created.id);
                this.showToast('订阅已添加');
            }
            void goBack();
        }
        catch (_) {
            this.showToast('添加失败，请检查链接或网络');
        }
        finally {
            this.isSubmitting = false;
        }
    }
    private showToast(message: string, duration: number = 2000): void {
        try {
            this.getUIContext().getPromptAction().showToast({ message, duration });
        }
        catch (error) {
            console.error(`showToast failed: ${error instanceof Error ? error.message : error}`);
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 0 });
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 20, bottom: 12 });
        }, Column);
        this.HeaderSection.bind(this)();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isLoading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING });
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        LoadingProgress.create();
                        LoadingProgress.width(42);
                        LoadingProgress.height(42);
                        LoadingProgress.color(this.theme.accent);
                    }, LoadingProgress);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('正在加载订阅预览...');
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
                        Column.padding({ left: 18, right: 18, bottom: 18 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.padding(20);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(24);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('预览失败');
                        Text.fontSize(20);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#EF4444');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.previewError);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                        Text.lineHeight(22);
                    }, Text);
                    Text.pop();
                    Column.pop();
                    Column.pop();
                });
            }
            else if (this.previewPayload) {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.layoutWeight(1);
                        Scroll.scrollBar(BarState.Off);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 18 });
                        Column.width('100%');
                        Column.padding({ left: 18, right: 18, top: 0, bottom: 24 });
                    }, Column);
                    this.HeroCard.bind(this)();
                    this.PreviewSection.bind(this)();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.height(104);
                        Row.width('100%');
                    }, Row);
                    Row.pop();
                    Column.pop();
                    Scroll.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.padding({ left: 18, right: 18 });
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        LoadingProgress.create();
                        LoadingProgress.width(42);
                        LoadingProgress.height(42);
                        LoadingProgress.color(this.theme.accent);
                    }, LoadingProgress);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('正在初始化页面...');
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.previewPayload && !this.isLoading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 10 });
                        Row.width('100%');
                        Row.padding({ left: 18, right: 18, top: 12, bottom: 18 });
                        Row.backgroundColor(this.theme.background);
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Button.createWithLabel(this.isSubmitting ? '处理中...' : (this.existingFeed ? '更新订阅' : '添加订阅'));
                        Button.type(ButtonType.Capsule);
                        Button.backgroundColor(this.theme.accent);
                        Button.fontColor('#FFFFFF');
                        Button.enabled(!this.isSubmitting);
                        Button.layoutWeight(1);
                        Button.height(54);
                        Button.fontSize(18);
                        Button.fontWeight(FontWeight.Bold);
                        Button.onClick(() => { void this.submit(); });
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
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "DiscoverPreview";
    }
}
registerNamedRoute(() => new DiscoverPreview(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/DiscoverPreview", pageFullPath: "entry/src/main/ets/pages/DiscoverPreview", integratedHsp: "false", moduleType: "followWithHap" });

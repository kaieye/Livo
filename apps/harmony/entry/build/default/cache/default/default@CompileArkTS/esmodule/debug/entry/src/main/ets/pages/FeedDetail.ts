if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface FeedDetail_Params {
    feedId?: string;
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetImageUrl?: string;
    targetDescription?: string;
    targetCategory?: string;
    targetView?: FeedViewType;
    sourceKind?: string;
    theme?: ThemePalette;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { getStringParams, goBack, openArticleDetail, openDiscoverSubscribeConfig } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { FeedViewType, toArticleDetailModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, Feed } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { FeedDetailView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedDetailView";
import type { FeedRefreshPayload } from '../common/services/RssFeedService';
class FeedDetail extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__feedId = new ObservedPropertySimplePU('', this, "feedId");
        this.__targetUrl = new ObservedPropertySimplePU('', this, "targetUrl");
        this.__targetTitle = new ObservedPropertySimplePU('', this, "targetTitle");
        this.__targetSiteUrl = new ObservedPropertySimplePU('', this, "targetSiteUrl");
        this.__targetImageUrl = new ObservedPropertySimplePU('', this, "targetImageUrl");
        this.__targetDescription = new ObservedPropertySimplePU('', this, "targetDescription");
        this.__targetCategory = new ObservedPropertySimplePU('', this, "targetCategory");
        this.__targetView = new ObservedPropertySimplePU(FeedViewType.Articles, this, "targetView");
        this.__sourceKind = new ObservedPropertySimplePU('', this, "sourceKind");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.lightPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: FeedDetail_Params) {
        if (params.feedId !== undefined) {
            this.feedId = params.feedId;
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
        if (params.targetImageUrl !== undefined) {
            this.targetImageUrl = params.targetImageUrl;
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
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: FeedDetail_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__feedId.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__targetView.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feedId.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetImageUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__targetView.aboutToBeDeleted();
        this.__sourceKind.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __feedId: ObservedPropertySimplePU<string>;
    get feedId() {
        return this.__feedId.get();
    }
    set feedId(newValue: string) {
        this.__feedId.set(newValue);
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
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        const params = getStringParams();
        if (params) {
            this.feedId = params.feedId ?? '';
            this.targetUrl = params.targetUrl ?? '';
            this.targetTitle = params.targetTitle ?? '';
            this.targetSiteUrl = params.siteUrl ?? '';
            this.targetImageUrl = params.imageUrl ?? '';
            this.targetDescription = params.description ?? '';
            this.targetCategory = params.category ?? '';
            this.sourceKind = params.sourceKind ?? '';
            const parsedView = Number(params.view ?? FeedViewType.Articles);
            this.targetView = parsedView as FeedViewType;
        }
        void this.loadSettings();
    }
    private async loadSettings(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
    }
    private openEditPage(feed: Feed): void {
        void openDiscoverSubscribeConfig({
            targetUrl: feed.url,
            targetTitle: feed.title,
            targetView: feed.view as FeedViewType,
            siteUrl: feed.siteUrl || '',
            imageUrl: feed.imageUrl || '',
            description: feed.description || '',
            sourceKind: '编辑',
            category: feed.category || '',
        });
    }
    private handleSubscribe(payload: FeedRefreshPayload): void {
        void openDiscoverSubscribeConfig({
            targetUrl: this.targetUrl,
            targetTitle: payload.feedTitle || this.targetTitle,
            targetView: this.targetView,
            siteUrl: payload.siteUrl || this.targetSiteUrl,
            imageUrl: payload.imageUrl || this.targetImageUrl,
            description: payload.description || this.targetDescription,
            sourceKind: this.sourceKind,
            category: this.targetCategory,
        });
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new FeedDetailView(this, {
                        feedId: this.feedId,
                        targetUrl: this.targetUrl,
                        initialTargetTitle: this.targetTitle,
                        initialTargetSiteUrl: this.targetSiteUrl,
                        initialTargetImageUrl: this.targetImageUrl,
                        initialTargetDescription: this.targetDescription,
                        targetCategory: this.targetCategory,
                        targetView: this.targetView,
                        theme: this.theme,
                        onBack: () => { void goBack(); },
                        onEdit: (feed: Feed) => { this.openEditPage(feed); },
                        onSubscribe: (payload: FeedRefreshPayload) => { this.handleSubscribe(payload); },
                        onOpenArticle: (entry: Entry, feed: Feed) => {
                            const model = toArticleDetailModel(entry, feed);
                            void openArticleDetail(entry.id || 'preview', JSON.stringify(model));
                        }
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/FeedDetail.ets", line: 72, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            feedId: this.feedId,
                            targetUrl: this.targetUrl,
                            initialTargetTitle: this.targetTitle,
                            initialTargetSiteUrl: this.targetSiteUrl,
                            initialTargetImageUrl: this.targetImageUrl,
                            initialTargetDescription: this.targetDescription,
                            targetCategory: this.targetCategory,
                            targetView: this.targetView,
                            theme: this.theme,
                            onBack: () => { void goBack(); },
                            onEdit: (feed: Feed) => { this.openEditPage(feed); },
                            onSubscribe: (payload: FeedRefreshPayload) => { this.handleSubscribe(payload); },
                            onOpenArticle: (entry: Entry, feed: Feed) => {
                                const model = toArticleDetailModel(entry, feed);
                                void openArticleDetail(entry.id || 'preview', JSON.stringify(model));
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        feedId: this.feedId,
                        targetUrl: this.targetUrl,
                        initialTargetTitle: this.targetTitle,
                        initialTargetSiteUrl: this.targetSiteUrl,
                        initialTargetImageUrl: this.targetImageUrl,
                        initialTargetDescription: this.targetDescription,
                        targetCategory: this.targetCategory,
                        targetView: this.targetView,
                        theme: this.theme
                    });
                }
            }, { name: "FeedDetailView" });
        }
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "FeedDetail";
    }
}
registerNamedRoute(() => new FeedDetail(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/FeedDetail", pageFullPath: "entry/src/main/ets/pages/FeedDetail", integratedHsp: "false", moduleType: "followWithHap" });

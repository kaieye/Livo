if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface DiscoverSubscribeConfig_Params {
    theme?: ThemePalette;
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetImageUrl?: string;
    targetDescription?: string;
    targetCategory?: string;
    sourceKind?: string;
    selectedView?: FeedViewType;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { FeedSubscribeConfigView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedSubscribeConfigView";
import { getStringParams, goBack } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { FeedViewType } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
class DiscoverSubscribeConfig extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.lightPalette(), this, "theme");
        this.__targetUrl = new ObservedPropertySimplePU('', this, "targetUrl");
        this.__targetTitle = new ObservedPropertySimplePU('', this, "targetTitle");
        this.__targetSiteUrl = new ObservedPropertySimplePU('', this, "targetSiteUrl");
        this.__targetImageUrl = new ObservedPropertySimplePU('', this, "targetImageUrl");
        this.__targetDescription = new ObservedPropertySimplePU('', this, "targetDescription");
        this.__targetCategory = new ObservedPropertySimplePU('', this, "targetCategory");
        this.__sourceKind = new ObservedPropertySimplePU('', this, "sourceKind");
        this.__selectedView = new ObservedPropertySimplePU(FeedViewType.Articles, this, "selectedView");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DiscoverSubscribeConfig_Params) {
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
        if (params.targetImageUrl !== undefined) {
            this.targetImageUrl = params.targetImageUrl;
        }
        if (params.targetDescription !== undefined) {
            this.targetDescription = params.targetDescription;
        }
        if (params.targetCategory !== undefined) {
            this.targetCategory = params.targetCategory;
        }
        if (params.sourceKind !== undefined) {
            this.sourceKind = params.sourceKind;
        }
        if (params.selectedView !== undefined) {
            this.selectedView = params.selectedView;
        }
    }
    updateStateVars(params: DiscoverSubscribeConfig_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__targetUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetTitle.purgeDependencyOnElmtId(rmElmtId);
        this.__targetSiteUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__targetCategory.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedView.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetImageUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
        this.__targetCategory.aboutToBeDeleted();
        this.__sourceKind.aboutToBeDeleted();
        this.__selectedView.aboutToBeDeleted();
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
    private __sourceKind: ObservedPropertySimplePU<string>;
    get sourceKind() {
        return this.__sourceKind.get();
    }
    set sourceKind(newValue: string) {
        this.__sourceKind.set(newValue);
    }
    private __selectedView: ObservedPropertySimplePU<FeedViewType>;
    get selectedView() {
        return this.__selectedView.get();
    }
    set selectedView(newValue: FeedViewType) {
        this.__selectedView.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadPage();
    }
    private async loadPage(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        const params = getStringParams();
        this.targetUrl = params.targetUrl ?? '';
        this.targetTitle = params.targetTitle ?? '';
        this.targetSiteUrl = params.siteUrl ?? '';
        this.targetImageUrl = params.imageUrl ?? '';
        this.targetDescription = params.description ?? '';
        this.targetCategory = params.category ?? '';
        this.sourceKind = params.sourceKind ?? '';
        this.selectedView = Number(params.view ?? FeedViewType.Articles) as FeedViewType;
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
                    let componentCall = new FeedSubscribeConfigView(this, {
                        targetUrl: this.targetUrl,
                        targetTitle: this.targetTitle,
                        targetSiteUrl: this.targetSiteUrl,
                        targetImageUrl: this.targetImageUrl,
                        targetDescription: this.targetDescription,
                        targetCategory: this.targetCategory,
                        sourceKind: this.sourceKind,
                        initialSelectedView: this.selectedView,
                        theme: this.theme,
                        onBack: () => { void goBack(); },
                        onSubscribed: () => { void goBack(); },
                        onSaved: () => { void goBack(); },
                        onUnsubscribed: () => { void goBack(); },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/DiscoverSubscribeConfig.ets", line: 41, col: 7 });
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
                            initialSelectedView: this.selectedView,
                            theme: this.theme,
                            onBack: () => { void goBack(); },
                            onSubscribed: () => { void goBack(); },
                            onSaved: () => { void goBack(); },
                            onUnsubscribed: () => { void goBack(); }
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
                        initialSelectedView: this.selectedView,
                        theme: this.theme
                    });
                }
            }, { name: "FeedSubscribeConfigView" });
        }
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "DiscoverSubscribeConfig";
    }
}
registerNamedRoute(() => new DiscoverSubscribeConfig(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/DiscoverSubscribeConfig", pageFullPath: "entry/src/main/ets/pages/DiscoverSubscribeConfig", integratedHsp: "false", moduleType: "followWithHap" });

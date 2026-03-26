if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface DiscoverSubscribeConfig_Params {
    theme?: ThemePalette;
    targetUrl?: string;
    targetTitle?: string;
    targetSiteUrl?: string;
    targetDescription?: string;
    sourceKind?: string;
    selectedView?: FeedViewType;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { FeedViewType } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
interface ConfigOption {
    view: FeedViewType;
    label: string;
    description: string;
}
class DiscoverSubscribeConfig extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.__targetUrl = new ObservedPropertySimplePU('', this, "targetUrl");
        this.__targetTitle = new ObservedPropertySimplePU('', this, "targetTitle");
        this.__targetSiteUrl = new ObservedPropertySimplePU('', this, "targetSiteUrl");
        this.__targetDescription = new ObservedPropertySimplePU('', this, "targetDescription");
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
        if (params.targetDescription !== undefined) {
            this.targetDescription = params.targetDescription;
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
        this.__targetDescription.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceKind.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedView.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
        this.__targetUrl.aboutToBeDeleted();
        this.__targetTitle.aboutToBeDeleted();
        this.__targetSiteUrl.aboutToBeDeleted();
        this.__targetDescription.aboutToBeDeleted();
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
    private __targetDescription: ObservedPropertySimplePU<string>;
    get targetDescription() {
        return this.__targetDescription.get();
    }
    set targetDescription(newValue: string) {
        this.__targetDescription.set(newValue);
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
        const params = router.getParams() as Record<string, string>;
        this.targetUrl = params.targetUrl ?? '';
        this.targetTitle = params.targetTitle ?? '';
        this.targetSiteUrl = params.siteUrl ?? '';
        this.targetDescription = params.description ?? '';
        this.sourceKind = params.sourceKind ?? '';
        this.selectedView = Number(params.view ?? FeedViewType.Articles) as FeedViewType;
    }
    private options(): ConfigOption[] {
        if (this.isBilibiliSource()) {
            return [
                { view: FeedViewType.SocialMedia, label: '社交', description: '订阅 Bilibili 动态更新' },
                { view: FeedViewType.Videos, label: '视频', description: '订阅 Bilibili 视频更新' },
            ];
        }
        return [
            { view: FeedViewType.Articles, label: '文章', description: '适合博客、资讯和长文内容' },
            { view: FeedViewType.SocialMedia, label: '社交', description: '适合动态流、短内容和讨论' },
            { view: FeedViewType.Pictures, label: '图片', description: '适合图片集、摄影和视觉内容' },
            { view: FeedViewType.Videos, label: '视频', description: '适合频道更新、视频和播客' },
        ];
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
    private continueToPreview(): void {
        router.pushUrl({
            url: 'pages/DiscoverPreview',
            params: {
                targetUrl: this.mappedTargetUrl(),
                targetTitle: this.targetTitle,
                view: `${this.selectedView}`,
                siteUrl: this.targetSiteUrl,
                description: this.targetDescription,
                sourceKind: this.sourceKind,
                category: '',
            },
        });
    }
    private HeaderSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('‹');
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.width(40);
            Text.height(40);
            Text.textAlign(TextAlign.Center);
            Text.borderRadius(999);
            Text.backgroundColor(this.theme.elevated);
            Text.onClick(() => router.back());
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        Row.pop();
    }
    private OptionCard(option: ConfigOption, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 6 });
            Context.animation({ duration: 180, curve: Curve.EaseInOut });
            Column.width('100%');
            Column.padding(16);
            Column.backgroundColor(this.selectedView === option.view ? this.theme.accent : this.theme.surface);
            Column.borderRadius(22);
            Column.alignItems(HorizontalAlign.Start);
            Context.animation(null);
            Column.onClick(() => {
                this.selectedView = option.view;
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(option.label);
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.selectedView === option.view ? '#FFFFFF' : this.theme.textPrimary);
            Text.width('100%');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(option.description);
            Text.fontSize(12);
            Text.lineHeight(20);
            Text.fontColor(this.selectedView === option.view ? 'rgba(255,255,255,0.82)' : this.theme.textSecondary);
            Text.width('100%');
        }, Text);
        Text.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.width('100%');
            Column.height('100%');
            Column.padding({ left: 18, right: 18, top: 20, bottom: 24 });
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.HeaderSection.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 6 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('订阅到哪个栏目');
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.width('100%');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.targetTitle || '选择一个最合适的栏目，然后继续预览。');
            Text.fontSize(14);
            Text.fontColor(this.theme.textSecondary);
            Text.width('100%');
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const option = _item;
                this.OptionCard.bind(this)(option);
            };
            this.forEachUpdateFunction(elmtId, this.options(), forEachItemGenFunction, (option: ConfigOption) => `${option.view}`, false, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('继续');
            Button.type(ButtonType.Capsule);
            Button.width('100%');
            Button.height(54);
            Button.fontSize(18);
            Button.fontWeight(FontWeight.Bold);
            Button.backgroundColor(this.theme.accent);
            Button.fontColor('#FFFFFF');
            Button.onClick(() => {
                this.continueToPreview();
            });
        }, Button);
        Button.pop();
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

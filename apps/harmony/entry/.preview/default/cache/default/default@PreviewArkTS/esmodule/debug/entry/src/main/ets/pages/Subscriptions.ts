if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Subscriptions_Params {
    feeds?: FeedCardModel[];
    selectedFeedId?: string;
    statusHint?: string;
    isSaving?: boolean;
    titleInput?: string;
    urlInput?: string;
    siteUrlInput?: string;
    descriptionInput?: string;
    categoryInput?: string;
    selectedView?: FeedViewType;
    showInAll?: boolean;
    mode?: SubscriptionMode;
    theme?: ThemePalette;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { FeedViewType } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { FeedCardModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { FeedDraft } from '../common/repositories/FeedRepository';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos';
class Subscriptions extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__feeds = new ObservedPropertyObjectPU([], this, "feeds");
        this.__selectedFeedId = new ObservedPropertySimplePU('', this, "selectedFeedId");
        this.__statusHint = new ObservedPropertySimplePU('正在加载订阅...', this, "statusHint");
        this.__isSaving = new ObservedPropertySimplePU(false, this, "isSaving");
        this.__titleInput = new ObservedPropertySimplePU('', this, "titleInput");
        this.__urlInput = new ObservedPropertySimplePU('', this, "urlInput");
        this.__siteUrlInput = new ObservedPropertySimplePU('', this, "siteUrlInput");
        this.__descriptionInput = new ObservedPropertySimplePU('', this, "descriptionInput");
        this.__categoryInput = new ObservedPropertySimplePU('', this, "categoryInput");
        this.__selectedView = new ObservedPropertySimplePU(FeedViewType.Articles, this, "selectedView");
        this.__showInAll = new ObservedPropertySimplePU(true, this, "showInAll");
        this.__mode = new ObservedPropertySimplePU('articles', this, "mode");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Subscriptions_Params) {
        if (params.feeds !== undefined) {
            this.feeds = params.feeds;
        }
        if (params.selectedFeedId !== undefined) {
            this.selectedFeedId = params.selectedFeedId;
        }
        if (params.statusHint !== undefined) {
            this.statusHint = params.statusHint;
        }
        if (params.isSaving !== undefined) {
            this.isSaving = params.isSaving;
        }
        if (params.titleInput !== undefined) {
            this.titleInput = params.titleInput;
        }
        if (params.urlInput !== undefined) {
            this.urlInput = params.urlInput;
        }
        if (params.siteUrlInput !== undefined) {
            this.siteUrlInput = params.siteUrlInput;
        }
        if (params.descriptionInput !== undefined) {
            this.descriptionInput = params.descriptionInput;
        }
        if (params.categoryInput !== undefined) {
            this.categoryInput = params.categoryInput;
        }
        if (params.selectedView !== undefined) {
            this.selectedView = params.selectedView;
        }
        if (params.showInAll !== undefined) {
            this.showInAll = params.showInAll;
        }
        if (params.mode !== undefined) {
            this.mode = params.mode;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: Subscriptions_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__feeds.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedFeedId.purgeDependencyOnElmtId(rmElmtId);
        this.__statusHint.purgeDependencyOnElmtId(rmElmtId);
        this.__isSaving.purgeDependencyOnElmtId(rmElmtId);
        this.__titleInput.purgeDependencyOnElmtId(rmElmtId);
        this.__urlInput.purgeDependencyOnElmtId(rmElmtId);
        this.__siteUrlInput.purgeDependencyOnElmtId(rmElmtId);
        this.__descriptionInput.purgeDependencyOnElmtId(rmElmtId);
        this.__categoryInput.purgeDependencyOnElmtId(rmElmtId);
        this.__selectedView.purgeDependencyOnElmtId(rmElmtId);
        this.__showInAll.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feeds.aboutToBeDeleted();
        this.__selectedFeedId.aboutToBeDeleted();
        this.__statusHint.aboutToBeDeleted();
        this.__isSaving.aboutToBeDeleted();
        this.__titleInput.aboutToBeDeleted();
        this.__urlInput.aboutToBeDeleted();
        this.__siteUrlInput.aboutToBeDeleted();
        this.__descriptionInput.aboutToBeDeleted();
        this.__categoryInput.aboutToBeDeleted();
        this.__selectedView.aboutToBeDeleted();
        this.__showInAll.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __feeds: ObservedPropertyObjectPU<FeedCardModel[]>;
    get feeds() {
        return this.__feeds.get();
    }
    set feeds(newValue: FeedCardModel[]) {
        this.__feeds.set(newValue);
    }
    private __selectedFeedId: ObservedPropertySimplePU<string>;
    get selectedFeedId() {
        return this.__selectedFeedId.get();
    }
    set selectedFeedId(newValue: string) {
        this.__selectedFeedId.set(newValue);
    }
    private __statusHint: ObservedPropertySimplePU<string>;
    get statusHint() {
        return this.__statusHint.get();
    }
    set statusHint(newValue: string) {
        this.__statusHint.set(newValue);
    }
    private __isSaving: ObservedPropertySimplePU<boolean>;
    get isSaving() {
        return this.__isSaving.get();
    }
    set isSaving(newValue: boolean) {
        this.__isSaving.set(newValue);
    }
    private __titleInput: ObservedPropertySimplePU<string>;
    get titleInput() {
        return this.__titleInput.get();
    }
    set titleInput(newValue: string) {
        this.__titleInput.set(newValue);
    }
    private __urlInput: ObservedPropertySimplePU<string>;
    get urlInput() {
        return this.__urlInput.get();
    }
    set urlInput(newValue: string) {
        this.__urlInput.set(newValue);
    }
    private __siteUrlInput: ObservedPropertySimplePU<string>;
    get siteUrlInput() {
        return this.__siteUrlInput.get();
    }
    set siteUrlInput(newValue: string) {
        this.__siteUrlInput.set(newValue);
    }
    private __descriptionInput: ObservedPropertySimplePU<string>;
    get descriptionInput() {
        return this.__descriptionInput.get();
    }
    set descriptionInput(newValue: string) {
        this.__descriptionInput.set(newValue);
    }
    private __categoryInput: ObservedPropertySimplePU<string>;
    get categoryInput() {
        return this.__categoryInput.get();
    }
    set categoryInput(newValue: string) {
        this.__categoryInput.set(newValue);
    }
    private __selectedView: ObservedPropertySimplePU<FeedViewType>;
    get selectedView() {
        return this.__selectedView.get();
    }
    set selectedView(newValue: FeedViewType) {
        this.__selectedView.set(newValue);
    }
    private __showInAll: ObservedPropertySimplePU<boolean>;
    get showInAll() {
        return this.__showInAll.get();
    }
    set showInAll(newValue: boolean) {
        this.__showInAll.set(newValue);
    }
    private __mode: ObservedPropertySimplePU<SubscriptionMode>;
    get mode() {
        return this.__mode.get();
    }
    set mode(newValue: SubscriptionMode) {
        this.__mode.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadFeeds();
    }
    private async loadFeeds(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        this.feeds = await AppRepository.feeds();
        if (!this.selectedFeedId && this.feeds.length > 0) {
            this.selectedFeedId = this.feeds[0].id;
        }
        await this.populateFormFromSelection();
    }
    private async populateFormFromSelection(): Promise<void> {
        if (!this.selectedFeedId) {
            return;
        }
        const feed = await AppRepository.feedEntityById(this.selectedFeedId);
        if (!feed) {
            return;
        }
        this.titleInput = feed.title;
        this.urlInput = feed.url;
        this.siteUrlInput = feed.siteUrl ?? '';
        this.descriptionInput = feed.description ?? '';
        this.categoryInput = feed.category ?? '';
        this.selectedView = feed.view;
        this.showInAll = feed.showInAll;
    }
    private draft(): FeedDraft {
        return {
            title: this.titleInput,
            url: this.urlInput,
            siteUrl: this.siteUrlInput,
            description: this.descriptionInput,
            category: this.categoryInput,
            view: this.selectedView,
            showInAll: this.showInAll,
        };
    }
    private async createFeed(): Promise<void> {
        if (!this.titleInput.trim() || !this.urlInput.trim()) {
            this.statusHint = '请填写订阅标题和 RSS 地址';
            return;
        }
        this.isSaving = true;
        try {
            const created = await AppRepository.createFeed(this.draft());
            this.selectedFeedId = created.id;
            this.statusHint = '新订阅已创建';
            await this.loadFeeds();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.statusHint = `创建失败：${message}`;
        }
        finally {
            this.isSaving = false;
        }
    }
    private async updateFeed(): Promise<void> {
        if (!this.selectedFeedId) {
            this.statusHint = '请先选择要编辑的订阅';
            return;
        }
        this.isSaving = true;
        try {
            await AppRepository.updateFeed(this.selectedFeedId, this.draft());
            this.statusHint = '订阅已更新';
            await this.loadFeeds();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.statusHint = `更新失败：${message}`;
        }
        finally {
            this.isSaving = false;
        }
    }
    private async deleteFeed(): Promise<void> {
        if (!this.selectedFeedId) {
            return;
        }
        this.isSaving = true;
        try {
            await AppRepository.removeFeed(this.selectedFeedId);
            this.selectedFeedId = '';
            this.statusHint = '订阅已删除';
            await this.loadFeeds();
        }
        finally {
            this.isSaving = false;
        }
    }
    private headerTitle(): string {
        switch (this.mode) {
            case 'social':
                return '社交';
            case 'pictures':
                return '图片';
            case 'videos':
                return '视频';
            default:
                return '文章';
        }
    }
    private filteredFeeds(): FeedCardModel[] {
        const label = this.mode === 'articles'
            ? '文章'
            : this.mode === 'social'
                ? '社交'
                : this.mode === 'pictures'
                    ? '图片'
                    : '视频';
        const matching = this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === label);
        return matching.length > 0 ? matching : this.feeds;
    }
    private deriveFallbackIcon(siteUrl: string): string {
        const trimmed = siteUrl.trim();
        if (!trimmed) {
            return '';
        }
        // ArkTS 不支持 URL 构造函数，使用简单的字符串处理
        try {
            const protocolMatch = trimmed.match(/^(https?:)/);
            const protocol = protocolMatch ? protocolMatch[1] : 'https:';
            const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
            const host = withoutProtocol.split('/')[0];
            return `${protocol}//${host}/favicon.ico`;
        }
        catch (_) {
            return '';
        }
    }
    private iconSource(feed: FeedCardModel): string {
        if (feed.imageUrl.trim().length > 0) {
            return feed.imageUrl.trim();
        }
        return this.deriveFallbackIcon(feed.siteUrl);
    }
    private ModeIcon(mode: SubscriptionMode, active: boolean, large: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Image.create(icon);
            Image.debugLine("entry/src/main/ets/pages/Subscriptions.ets(192:5)", "entry");
            Image.width(large ? 18 : 20);
            Image.height(large ? 18 : 20);
            Image.objectFit(ImageFit.Contain);
        }, Image);
    }
    private ModePill(mode: SubscriptionMode, label: string, large: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 10 });
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(200:5)", "entry");
            Row.height(74);
            Row.padding({ left: large ? 26 : 0, right: large ? 26 : 0 });
            Row.backgroundColor(this.mode === mode ? this.theme.accent : this.theme.elevated);
            Row.borderRadius(28);
            Row.justifyContent(FlexAlign.Center);
            Row.layoutWeight(large ? 1 : 0);
            Row.width(large ? 'auto' : 86);
            Row.onClick(() => { this.mode = mode; });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (large) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.Center });
                        Stack.debugLine("entry/src/main/ets/pages/Subscriptions.ets(202:9)", "entry");
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(203:11)", "entry");
                        Row.width(30);
                        Row.height(30);
                        Row.borderRadius(10);
                        Row.backgroundColor(this.mode === mode ? this.theme.surface : this.theme.elevated);
                    }, Row);
                    Row.pop();
                    this.ModeIcon.bind(this)(mode, this.mode === mode, true);
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
            If.create();
            if (!large) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.ModeIcon.bind(this)(mode, this.mode === mode, false);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(217:7)", "entry");
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.mode === mode ? this.theme.accentText : this.theme.textSecondary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (large) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('•');
                        Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(223:9)", "entry");
                        Text.fontSize(16);
                        Text.fontColor(this.theme.accentText);
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
    private FavoritesCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 16 });
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(240:5)", "entry");
            Row.width('100%');
            Row.height(72);
            Row.padding({ left: 24, right: 24 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(24);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/pages/Subscriptions.ets(241:7)", "entry");
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(242:9)", "entry");
            Row.width(34);
            Row.height(34);
            Row.borderRadius(10);
            Row.backgroundColor(this.theme.accent);
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('★');
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(248:9)", "entry");
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.accentText);
        }, Text);
        Text.pop();
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('收藏');
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(254:7)", "entry");
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private FeedRow(feed: FeedCardModel, showDivider: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/pages/Subscriptions.ets(268:5)", "entry");
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 14 });
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(269:7)", "entry");
            Row.width('100%');
            Row.padding({ left: 18, right: 18, top: 18, bottom: 18 });
            Row.onClick(() => {
                this.selectedFeedId = feed.id;
                void this.populateFormFromSelection();
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (feed.title === 'Blogs' || feed.title === 'Recommended') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('›');
                        Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(271:11)", "entry");
                        Text.fontSize(26);
                        Text.fontWeight(FontWeight.Lighter);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.Center });
                        Stack.debugLine("entry/src/main/ets/pages/Subscriptions.ets(276:11)", "entry");
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(277:13)", "entry");
                        Row.width(26);
                        Row.height(26);
                        Row.borderRadius(8);
                        Row.backgroundColor(feed.viewBadgeColor);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(feed.title.substring(0, 1));
                        Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(283:13)", "entry");
                        Text.fontSize(13);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.iconSource(feed).length > 0) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Image.create(this.iconSource(feed));
                                    Image.debugLine("entry/src/main/ets/pages/Subscriptions.ets(289:15)", "entry");
                                    Image.width(26);
                                    Image.height(26);
                                    Image.borderRadius(8);
                                    Image.objectFit(ImageFit.Cover);
                                }, Image);
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
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(feed.title);
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(298:9)", "entry");
            Text.fontSize(18);
            Text.fontColor(feed.title.includes('Welcome') ? '#FF5E42' : this.theme.textPrimary);
            Text.layoutWeight(1);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(305:9)", "entry");
            Row.width(6);
            Row.height(6);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.textMuted);
        }, Row);
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (showDivider) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Divider.create();
                        Divider.debugLine("entry/src/main/ets/pages/Subscriptions.ets(319:9)", "entry");
                        Divider.strokeWidth(1);
                        Divider.color(this.theme.divider);
                        Divider.margin({ left: 18, right: 18 });
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
    private EditorCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.debugLine("entry/src/main/ets/pages/Subscriptions.ets(330:5)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
            Column.padding(18);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('快速编辑');
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(331:7)", "entry");
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.statusHint);
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(336:7)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.titleInput, placeholder: '订阅标题' });
            TextInput.debugLine("entry/src/main/ets/pages/Subscriptions.ets(340:7)", "entry");
            TextInput.backgroundColor(this.theme.elevated);
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.borderRadius(14);
            TextInput.padding({ left: 14, right: 14, top: 12, bottom: 12 });
            TextInput.onChange((value: string) => { this.titleInput = value; });
        }, TextInput);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.urlInput, placeholder: 'RSS 地址' });
            TextInput.debugLine("entry/src/main/ets/pages/Subscriptions.ets(347:7)", "entry");
            TextInput.backgroundColor(this.theme.elevated);
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.borderRadius(14);
            TextInput.padding({ left: 14, right: 14, top: 12, bottom: 12 });
            TextInput.onChange((value: string) => { this.urlInput = value; });
        }, TextInput);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(354:7)", "entry");
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.isSaving ? '处理中' : '新建');
            Button.debugLine("entry/src/main/ets/pages/Subscriptions.ets(355:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.accent);
            Button.fontColor(this.theme.accentText);
            Button.enabled(!this.isSaving);
            Button.onClick(() => { void this.createFeed(); });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('更新');
            Button.debugLine("entry/src/main/ets/pages/Subscriptions.ets(362:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.enabled(!this.isSaving);
            Button.onClick(() => { void this.updateFeed(); });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('删除');
            Button.debugLine("entry/src/main/ets/pages/Subscriptions.ets(369:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.enabled(!this.isSaving);
            Button.onClick(() => { void this.deleteFeed(); });
        }, Button);
        Button.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(377:7)", "entry");
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('显示到首页');
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(378:9)", "entry");
            Text.fontSize(14);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/Subscriptions.ets(381:9)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: this.showInAll });
            Toggle.debugLine("entry/src/main/ets/pages/Subscriptions.ets(382:9)", "entry");
            Toggle.onChange((value: boolean) => { this.showInAll = value; });
        }, Toggle);
        Toggle.pop();
        Row.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.debugLine("entry/src/main/ets/pages/Subscriptions.ets(395:5)", "entry");
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.debugLine("entry/src/main/ets/pages/Subscriptions.ets(396:7)", "entry");
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 20 });
            Column.debugLine("entry/src/main/ets/pages/Subscriptions.ets(397:9)", "entry");
            Column.width('100%');
            Column.padding({ left: 18, right: 18, bottom: 126 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.headerTitle());
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(398:11)", "entry");
            Text.width('100%');
            Text.padding({ top: 18, bottom: 4 });
            Text.textAlign(TextAlign.Center);
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.debugLine("entry/src/main/ets/pages/Subscriptions.ets(406:11)", "entry");
            Row.width('100%');
        }, Row);
        this.ModePill.bind(this)('articles', '文章', true);
        this.ModePill.bind(this)('social', '', false);
        this.ModePill.bind(this)('pictures', '', false);
        this.ModePill.bind(this)('videos', '', false);
        Row.pop();
        this.FavoritesCard.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.debugLine("entry/src/main/ets/pages/Subscriptions.ets(416:11)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('订阅源');
            Text.debugLine("entry/src/main/ets/pages/Subscriptions.ets(417:13)", "entry");
            Text.fontSize(22);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/pages/Subscriptions.ets(422:13)", "entry");
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = (_item, index: number) => {
                const feed = _item;
                this.FeedRow.bind(this)(feed, index < this.filteredFeeds().length - 1);
            };
            this.forEachUpdateFunction(elmtId, this.filteredFeeds(), forEachItemGenFunction, (feed: FeedCardModel) => feed.id, true, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
        Column.pop();
        this.EditorCard.bind(this)();
        Column.pop();
        Scroll.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.align(Alignment.Bottom);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'subscriptions', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Subscriptions.ets", line: 442, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            activeTab: 'subscriptions',
                            theme: this.theme
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        activeTab: 'subscriptions', theme: this.theme
                    });
                }
            }, { name: "BottomTabs" });
        }
        __Common__.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Subscriptions";
    }
}
registerNamedRoute(() => new Subscriptions(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Subscriptions", pageFullPath: "entry/src/main/ets/pages/Subscriptions", integratedHsp: "false", moduleType: "followWithHap" });

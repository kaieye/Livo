if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Subscriptions_Params {
    feeds?: FeedCardModel[];
    mode?: SubscriptionMode;
    theme?: ThemePalette;
    sourceHint?: string;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import type { FeedCardModel } from '../common/models/LivoModels';
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
        this.__mode = new ObservedPropertySimplePU('articles', this, "mode");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.__sourceHint = new ObservedPropertySimplePU('正在加载订阅内容...', this, "sourceHint");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Subscriptions_Params) {
        if (params.feeds !== undefined) {
            this.feeds = params.feeds;
        }
        if (params.mode !== undefined) {
            this.mode = params.mode;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.sourceHint !== undefined) {
            this.sourceHint = params.sourceHint;
        }
    }
    updateStateVars(params: Subscriptions_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__feeds.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceHint.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feeds.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__sourceHint.aboutToBeDeleted();
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
    private __sourceHint: ObservedPropertySimplePU<string>;
    get sourceHint() {
        return this.__sourceHint.get();
    }
    set sourceHint(newValue: string) {
        this.__sourceHint.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadPageData();
    }
    private async loadPageData(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        this.feeds = await AppRepository.feeds();
        this.sourceHint = '已加载本地订阅内容';
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
    private modeIndex(): number {
        switch (this.mode) {
            case 'social':
                return 1;
            case 'pictures':
                return 2;
            case 'videos':
                return 3;
            default:
                return 0;
        }
    }
    private modeHighlightOffsetPercent(): string {
        return `${this.modeIndex() * 25}%`;
    }
    private getModeTitle(mode: SubscriptionMode): string {
        switch (mode) {
            case 'articles': return '文章';
            case 'social': return '社交';
            case 'pictures': return '图片';
            case 'videos': return '视频';
            default: return '';
        }
    }
    private modeLabel(): string {
        return this.headerTitle();
    }
    private filteredFeeds(): FeedCardModel[] {
        return this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === this.modeLabel());
    }
    private deriveFallbackIcon(siteUrl: string): string {
        const trimmed = siteUrl.trim();
        if (!trimmed) {
            return '';
        }
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
    private iconSource(feed: FeedCardModel | undefined): string {
        if (!feed) {
            return '';
        }
        if (feed.imageUrl.trim().length > 0) {
            return feed.imageUrl.trim();
        }
        return this.deriveFallbackIcon(feed.siteUrl);
    }
    private ModeIcon(mode: SubscriptionMode, active: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (mode === 'articles') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(active ? { "id": 16777227, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777228, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                    }, Image);
                });
            }
            else if (mode === 'social') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(active ? { "id": 16777231, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777232, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                    }, Image);
                });
            }
            else if (mode === 'pictures') {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(active ? { "id": 16777229, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777230, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(active ? { "id": 16777233, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777234, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                    }, Image);
                });
            }
        }, If);
        If.pop();
    }
    private ModeTab(mode: SubscriptionMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 6 });
            Row.layoutWeight(1);
            Row.height('100%');
            Row.justifyContent(FlexAlign.Center);
            Row.onClick(() => { this.mode = mode; });
        }, Row);
        this.ModeIcon.bind(this)(mode, this.mode === mode);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.getModeTitle(mode));
            Context.animation({ duration: 220, curve: Curve.EaseInOut });
            Text.fontSize(14);
            Text.fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular);
            Text.fontColor(this.mode === mode ? '#FFFFFF' : this.theme.textSecondary);
            Context.animation(null);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private ModeRail(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Start });
            Stack.width('100%');
            Stack.height(46);
            Stack.backgroundColor(this.theme.surface);
            Stack.borderRadius(18);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Context.animation({ duration: 280, curve: Curve.FastOutSlowIn });
            Row.width('25%');
            Row.height('100%');
            Row.padding(4);
            Row.offset({ x: this.modeHighlightOffsetPercent(), y: 0 });
            Context.animation(null);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height('100%');
            Row.borderRadius(14);
            Row.backgroundColor(this.theme.accent);
            Row.shadow({ radius: 8, color: 'rgba(255, 106, 0, 0.25)', offsetY: 2 });
        }, Row);
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height('100%');
        }, Row);
        this.ModeTab.bind(this)('articles');
        this.ModeTab.bind(this)('social');
        this.ModeTab.bind(this)('pictures');
        this.ModeTab.bind(this)('videos');
        Row.pop();
        Stack.pop();
    }
    private FeedAvatar(feed: FeedCardModel | undefined, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(22);
            Row.height(22);
            Row.borderRadius(6);
            Row.backgroundColor(this.theme.elevated);
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.iconSource(feed).length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.iconSource(feed));
                        Image.width(22);
                        Image.height(22);
                        Image.borderRadius(6);
                        Image.objectFit(ImageFit.Cover);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(feed ? feed.title.substring(0, 1) : 'L');
                        Text.fontSize(11);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private FeedRow(feed: FeedCardModel, showDivider: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.height(52);
            Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
            Row.clickEffect({ level: ClickEffectLevel.LIGHT });
            Row.onClick(() => {
                router.pushUrl({ url: 'pages/FeedDetail', params: { feedId: feed.id } });
            });
        }, Row);
        this.FeedAvatar.bind(this)(feed);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(feed.title);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.layoutWeight(1);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(4);
            Row.height(4);
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
                        Divider.strokeWidth(1);
                        Divider.color(this.theme.divider);
                        Divider.margin({ left: 50, right: 16 });
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
    private FeedSection(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('订阅源');
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textMuted);
            Text.padding({ left: 4 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredFeeds().length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding(18);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(22);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`您还没有收藏任何${this.headerTitle()}源`);
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('先添加对应类型的订阅源，或者刷新现有订阅后再回来看看。');
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
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(22);
                        Column.clip(true);
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
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            List.create({ space: 18 });
            List.width('100%');
            List.height('100%');
            List.padding({ left: 18, right: 18 });
            List.scrollBar(BarState.Off);
            List.backgroundColor(this.theme.background);
            List.edgeEffect(EdgeEffect.Spring);
        }, List);
        {
            const itemCreation = (elmtId, isInitialRender) => {
                ViewStackProcessor.StartGetAccessRecordingFor(elmtId);
                ListItem.create(deepRenderFunction, true);
                if (!isInitialRender) {
                    ListItem.pop();
                }
                ViewStackProcessor.StopGetAccessRecording();
            };
            const itemCreation2 = (elmtId, isInitialRender) => {
                ListItem.create(deepRenderFunction, true);
                ListItem.width('100%');
            };
            const deepRenderFunction = (elmtId, isInitialRender) => {
                itemCreation(elmtId, isInitialRender);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create({ space: 22 });
                    Column.width('100%');
                }, Column);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding({ top: 12 });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create('订阅库');
                    Text.fontSize(28);
                    Text.fontWeight(FontWeight.Bold);
                    Text.fontColor(this.theme.textPrimary);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Blank.create();
                }, Blank);
                Blank.pop();
                Row.pop();
                this.ModeRail.bind(this)();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding({ left: 4, right: 4 });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(`${this.filteredFeeds().length} 个订阅源`);
                    Text.fontSize(12);
                    Text.fontColor(this.theme.textSecondary);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Blank.create();
                }, Blank);
                Blank.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(this.sourceHint);
                    Text.fontSize(12);
                    Text.fontColor(this.theme.textMuted);
                }, Text);
                Text.pop();
                Row.pop();
                Column.pop();
                ListItem.pop();
            };
            this.observeComponentCreation2(itemCreation2, ListItem);
            ListItem.pop();
        }
        {
            const itemCreation = (elmtId, isInitialRender) => {
                ViewStackProcessor.StartGetAccessRecordingFor(elmtId);
                ListItem.create(deepRenderFunction, true);
                if (!isInitialRender) {
                    ListItem.pop();
                }
                ViewStackProcessor.StopGetAccessRecording();
            };
            const itemCreation2 = (elmtId, isInitialRender) => {
                ListItem.create(deepRenderFunction, true);
            };
            const deepRenderFunction = (elmtId, isInitialRender) => {
                itemCreation(elmtId, isInitialRender);
                this.FeedSection.bind(this)();
                ListItem.pop();
            };
            this.observeComponentCreation2(itemCreation2, ListItem);
            ListItem.pop();
        }
        {
            const itemCreation = (elmtId, isInitialRender) => {
                ViewStackProcessor.StartGetAccessRecordingFor(elmtId);
                ListItem.create(deepRenderFunction, true);
                if (!isInitialRender) {
                    ListItem.pop();
                }
                ViewStackProcessor.StopGetAccessRecording();
            };
            const itemCreation2 = (elmtId, isInitialRender) => {
                ListItem.create(deepRenderFunction, true);
            };
            const deepRenderFunction = (elmtId, isInitialRender) => {
                itemCreation(elmtId, isInitialRender);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.height(100);
                    Row.width('100%');
                }, Row);
                Row.pop();
                ListItem.pop();
            };
            this.observeComponentCreation2(itemCreation2, ListItem);
            ListItem.pop();
        }
        List.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.align(Alignment.Bottom);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'subscriptions', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Subscriptions.ets", line: 336, col: 7 });
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

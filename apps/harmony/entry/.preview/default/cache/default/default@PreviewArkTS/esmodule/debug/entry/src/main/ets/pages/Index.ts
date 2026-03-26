if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Index_Params {
    featuredEntries?: EntryCardModel[];
    feedSourceLabel?: string;
    isRefreshing?: boolean;
    searchQuery?: string;
    theme?: ThemePalette;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import type { EntryCardModel } from '../common/models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
class Index extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__featuredEntries = new ObservedPropertyObjectPU([], this, "featuredEntries");
        this.__feedSourceLabel = new ObservedPropertySimplePU('准备加载本地内容', this, "feedSourceLabel");
        this.__isRefreshing = new ObservedPropertySimplePU(false, this, "isRefreshing");
        this.__searchQuery = new ObservedPropertySimplePU('', this, "searchQuery");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Index_Params) {
        if (params.featuredEntries !== undefined) {
            this.featuredEntries = params.featuredEntries;
        }
        if (params.feedSourceLabel !== undefined) {
            this.feedSourceLabel = params.feedSourceLabel;
        }
        if (params.isRefreshing !== undefined) {
            this.isRefreshing = params.isRefreshing;
        }
        if (params.searchQuery !== undefined) {
            this.searchQuery = params.searchQuery;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: Index_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__featuredEntries.purgeDependencyOnElmtId(rmElmtId);
        this.__feedSourceLabel.purgeDependencyOnElmtId(rmElmtId);
        this.__isRefreshing.purgeDependencyOnElmtId(rmElmtId);
        this.__searchQuery.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__featuredEntries.aboutToBeDeleted();
        this.__feedSourceLabel.aboutToBeDeleted();
        this.__isRefreshing.aboutToBeDeleted();
        this.__searchQuery.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __featuredEntries: ObservedPropertyObjectPU<EntryCardModel[]>;
    get featuredEntries() {
        return this.__featuredEntries.get();
    }
    set featuredEntries(newValue: EntryCardModel[]) {
        this.__featuredEntries.set(newValue);
    }
    private __feedSourceLabel: ObservedPropertySimplePU<string>;
    get feedSourceLabel() {
        return this.__feedSourceLabel.get();
    }
    set feedSourceLabel(newValue: string) {
        this.__feedSourceLabel.set(newValue);
    }
    private __isRefreshing: ObservedPropertySimplePU<boolean>;
    get isRefreshing() {
        return this.__isRefreshing.get();
    }
    set isRefreshing(newValue: boolean) {
        this.__isRefreshing.set(newValue);
    }
    private __searchQuery: ObservedPropertySimplePU<string>;
    get searchQuery() {
        return this.__searchQuery.get();
    }
    set searchQuery(newValue: string) {
        this.__searchQuery.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        console.info('Livo Harmony Index aboutToAppear');
        void this.loadInitialData();
    }
    private async loadInitialData(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        this.featuredEntries = await AppRepository.featuredEntries();
        this.feedSourceLabel = '本地内容已加载';
        if (settings.autoRefresh) {
            await this.refreshFeaturedEntries();
        }
    }
    private async refreshFeaturedEntries(): Promise<void> {
        this.isRefreshing = true;
        try {
            const result = await AppRepository.refreshAllFeeds();
            this.featuredEntries = result.entries;
            this.feedSourceLabel = result.sourceLabel;
        }
        finally {
            this.isRefreshing = false;
        }
    }
    private openEntry(entryId: string): void {
        router.pushUrl({
            url: 'pages/ArticleDetail',
            params: { entryId },
        });
    }
    private filteredEntries(): EntryCardModel[] {
        const keyword = this.searchQuery.trim().toLowerCase();
        if (!keyword) {
            return this.featuredEntries;
        }
        return this.featuredEntries.filter((entry: EntryCardModel) => entry.title.toLowerCase().includes(keyword)
            || entry.summary.toLowerCase().includes(keyword)
            || entry.feedTitle.toLowerCase().includes(keyword));
    }
    private EntryCard(entry: EntryCardModel, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.debugLine("entry/src/main/ets/pages/Index.ets(66:5)", "entry");
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({ left: 16, right: 16, top: 16, bottom: 16 });
            Column.onClick(() => this.openEntry(entry.id));
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Feed 信息行
            Row.create({ space: 6 });
            Row.debugLine("entry/src/main/ets/pages/Index.ets(68:7)", "entry");
            // Feed 信息行
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.feedTitle);
            Text.debugLine("entry/src/main/ets/pages/Index.ets(69:9)", "entry");
            Text.fontSize(13);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.accent);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('·');
            Text.debugLine("entry/src/main/ets/pages/Index.ets(76:9)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.publishedLabel);
            Text.debugLine("entry/src/main/ets/pages/Index.ets(80:9)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (entry.readingLabel) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 4 });
                        Row.debugLine("entry/src/main/ets/pages/Index.ets(85:11)", "entry");
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('·');
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(86:13)", "entry");
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textMuted);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.readingLabel);
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(89:13)", "entry");
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textMuted);
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
        // Feed 信息行
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 标题
            Text.create(entry.title);
            Text.debugLine("entry/src/main/ets/pages/Index.ets(98:7)", "entry");
            // 标题
            Text.fontSize(16);
            // 标题
            Text.fontWeight(FontWeight.Bold);
            // 标题
            Text.fontColor(this.theme.textPrimary);
            // 标题
            Text.lineHeight(24);
            // 标题
            Text.maxLines(2);
            // 标题
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        // 标题
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            // 摘要（可选）
            if (entry.summary && entry.summary.length > 50) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.summary);
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(108:9)", "entry");
                        Text.fontSize(14);
                        Text.lineHeight(22);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(2);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                });
            }
            // 标签和作者
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 标签和作者
            Row.create({ space: 8 });
            Row.debugLine("entry/src/main/ets/pages/Index.ets(117:7)", "entry");
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (entry.tags.length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const tag = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(`#${tag}`);
                                Text.debugLine("entry/src/main/ets/pages/Index.ets(120:13)", "entry");
                                Text.fontSize(12);
                                Text.fontColor(this.theme.textSecondary);
                                Text.padding({ left: 8, right: 8, top: 4, bottom: 4 });
                                Text.backgroundColor(this.theme.elevated);
                                Text.borderRadius(8);
                            }, Text);
                            Text.pop();
                        };
                        this.forEachUpdateFunction(elmtId, entry.tags.slice(0, 2), forEachItemGenFunction, (tag: string) => tag, false, false);
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
            if (entry.author) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.author);
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(130:11)", "entry");
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textSecondary);
                        Text.margin({ left: 8 });
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
        // 标签和作者
        Row.pop();
        Column.pop();
    }
    private EntrySeparator(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Index.ets(144:5)", "entry");
            Row.width('100%');
            Row.height(0.5);
            Row.backgroundColor(this.theme.divider);
            Row.margin({ left: 16, right: 16 });
        }, Row);
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.debugLine("entry/src/main/ets/pages/Index.ets(152:5)", "entry");
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/pages/Index.ets(153:7)", "entry");
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.debugLine("entry/src/main/ets/pages/Index.ets(154:9)", "entry");
            Scroll.scrollBar(BarState.Off);
            Scroll.layoutWeight(1);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 20 });
            Column.debugLine("entry/src/main/ets/pages/Index.ets(155:11)", "entry");
            Column.width('100%');
            Column.padding({ left: 18, right: 18, bottom: 100 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.debugLine("entry/src/main/ets/pages/Index.ets(156:11)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Index.ets(157:13)", "entry");
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('今日推荐');
            Text.debugLine("entry/src/main/ets/pages/Index.ets(158:15)", "entry");
            Text.fontSize(22);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/Index.ets(163:15)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('查看全部');
            Text.debugLine("entry/src/main/ets/pages/Index.ets(165:15)", "entry");
            Text.fontSize(14);
            Text.fontColor(this.theme.accent);
            Text.onClick(() => router.pushUrl({ url: 'pages/Subscriptions' }));
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Index.ets(172:13)", "entry");
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.feedSourceLabel);
            Text.debugLine("entry/src/main/ets/pages/Index.ets(173:15)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.textSecondary);
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.isRefreshing ? '刷新中' : '刷新');
            Button.debugLine("entry/src/main/ets/pages/Index.ets(178:15)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.enabled(!this.isRefreshing);
            Button.onClick(() => { void this.refreshFeaturedEntries(); });
        }, Button);
        Button.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            TextInput.create({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源' });
            TextInput.debugLine("entry/src/main/ets/pages/Index.ets(187:13)", "entry");
            TextInput.backgroundColor(this.theme.surface);
            TextInput.fontColor(this.theme.textPrimary);
            TextInput.borderRadius(18);
            TextInput.padding({ left: 14, right: 14, top: 10, bottom: 10 });
            TextInput.onChange((value: string) => { this.searchQuery = value; });
        }, TextInput);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.searchQuery.trim()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`搜索结果：${this.filteredEntries().length} 条`);
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(195:15)", "entry");
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textSecondary);
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
            ForEach.create();
            const forEachItemGenFunction = (_item, index: number) => {
                const entry = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create();
                    Column.debugLine("entry/src/main/ets/pages/Index.ets(201:15)", "entry");
                }, Column);
                this.EntryCard.bind(this)(entry);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    If.create();
                    if (index < this.filteredEntries().length - 1) {
                        this.ifElseBranchUpdateFunction(0, () => {
                            this.EntrySeparator.bind(this)();
                        });
                    }
                    else {
                        this.ifElseBranchUpdateFunction(1, () => {
                        });
                    }
                }, If);
                If.pop();
                Column.pop();
            };
            this.forEachUpdateFunction(elmtId, this.filteredEntries(), forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
        }, ForEach);
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredEntries().length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('还没有可展示的条目，请先到订阅页添加或刷新订阅源。');
                        Text.debugLine("entry/src/main/ets/pages/Index.ets(210:15)", "entry");
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                        Text.padding(18);
                        Text.backgroundColor(this.theme.surface);
                        Text.borderRadius(20);
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.align(Alignment.Bottom);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'home', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 230, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            activeTab: 'home',
                            theme: this.theme
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        activeTab: 'home', theme: this.theme
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
        return "Index";
    }
}
registerNamedRoute(() => new Index(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Index", pageFullPath: "entry/src/main/ets/pages/Index", integratedHsp: "false", moduleType: "followWithHap" });

if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Index_Params {
    featuredEntries?: EntryCardModel[];
    feedSourceLabel?: string;
    isRefreshing?: boolean;
    searchQuery?: string;
    showSearch?: boolean;
    mode?: SubscriptionMode;
    theme?: ThemePalette;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import type { EntryCardModel } from '../common/models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos';
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
        this.__showSearch = new ObservedPropertySimplePU(false, this, "showSearch");
        this.__mode = new ObservedPropertySimplePU('articles', this, "mode");
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
        if (params.showSearch !== undefined) {
            this.showSearch = params.showSearch;
        }
        if (params.mode !== undefined) {
            this.mode = params.mode;
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
        this.__showSearch.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__featuredEntries.aboutToBeDeleted();
        this.__feedSourceLabel.aboutToBeDeleted();
        this.__isRefreshing.aboutToBeDeleted();
        this.__searchQuery.aboutToBeDeleted();
        this.__showSearch.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
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
    private __showSearch: ObservedPropertySimplePU<boolean>;
    get showSearch() {
        return this.__showSearch.get();
    }
    set showSearch(newValue: boolean) {
        this.__showSearch.set(newValue);
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
        let list = this.featuredEntries.filter((entry: EntryCardModel) => entry.viewLabel === this.getModeTitle(this.mode));
        const keyword = this.searchQuery.trim().toLowerCase();
        if (keyword) {
            list = list.filter((entry: EntryCardModel) => entry.title.toLowerCase().includes(keyword)
                || entry.summary.toLowerCase().includes(keyword)
                || entry.feedTitle.toLowerCase().includes(keyword));
        }
        return list;
    }
    private modeIndex(): number {
        switch (this.mode) {
            case 'social': return 1;
            case 'pictures': return 2;
            case 'videos': return 3;
            default: return 0;
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
    private EntryCard(entry: EntryCardModel, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({ left: 16, right: 16, top: 16, bottom: 16 });
            Column.borderRadius(16);
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => this.openEntry(entry.id));
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // Feed 信息行
            Row.create({ space: 6 });
            // Feed 信息行
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.feedTitle);
            Text.fontSize(13);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.accent);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('·');
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.publishedLabel);
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
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('·');
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textMuted);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.readingLabel);
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
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            List.create({ space: 14 });
            List.width('100%');
            List.height('100%');
            List.padding({ left: 18, right: 18 });
            List.scrollBar(BarState.Off);
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
                    Column.create({ space: 14 });
                    Column.width('100%');
                    Column.padding({ top: 12, bottom: 6 });
                }, Column);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding({ top: 12 });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create('今日推荐');
                    Text.fontSize(28);
                    Text.fontWeight(FontWeight.Bold);
                    Text.fontColor(this.theme.textPrimary);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Blank.create();
                }, Blank);
                Blank.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    SymbolGlyph.create({ "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                    SymbolGlyph.fontSize(26);
                    SymbolGlyph.fontColor([this.theme.textPrimary]);
                    SymbolGlyph.padding(8);
                    SymbolGlyph.clickEffect({ level: ClickEffectLevel.LIGHT });
                    SymbolGlyph.onClick(() => { this.showSearch = !this.showSearch; });
                }, SymbolGlyph);
                Row.pop();
                this.ModeRail.bind(this)();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding({ left: 4, right: 4 });
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(this.feedSourceLabel);
                    Text.fontSize(12);
                    Text.fontColor(this.theme.textSecondary);
                    Text.layoutWeight(1);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Button.createWithLabel(this.isRefreshing ? '刷新中' : '刷新');
                    Button.type(ButtonType.Capsule);
                    Button.backgroundColor(this.theme.elevated);
                    Button.fontColor(this.theme.textPrimary);
                    Button.enabled(!this.isRefreshing);
                    Button.clickEffect({ level: ClickEffectLevel.LIGHT });
                    Button.onClick(() => { void this.refreshFeaturedEntries(); });
                }, Button);
                Button.pop();
                Row.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    If.create();
                    if (this.showSearch) {
                        this.ifElseBranchUpdateFunction(0, () => {
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                TextInput.create({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源' });
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
                        });
                    }
                    else {
                        this.ifElseBranchUpdateFunction(1, () => {
                        });
                    }
                }, If);
                If.pop();
                Column.pop();
                ListItem.pop();
            };
            this.observeComponentCreation2(itemCreation2, ListItem);
            ListItem.pop();
        }
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = (_item, index: number) => {
                const entry = _item;
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
                            Column.create();
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
                        ListItem.pop();
                    };
                    this.observeComponentCreation2(itemCreation2, ListItem);
                    ListItem.pop();
                }
            };
            this.forEachUpdateFunction(elmtId, this.filteredEntries(), forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
        }, ForEach);
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredEntries().length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
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
                                Text.create('还没有可展示的条目，请先到订阅页添加或刷新订阅源。');
                                Text.fontSize(14);
                                Text.fontColor(this.theme.textSecondary);
                                Text.padding(18);
                                Text.backgroundColor(this.theme.surface);
                                Text.borderRadius(20);
                                Text.width('100%');
                            }, Text);
                            Text.pop();
                            ListItem.pop();
                        };
                        this.observeComponentCreation2(itemCreation2, ListItem);
                        ListItem.pop();
                    }
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.align(Alignment.Bottom);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'home', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 349, col: 7 });
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

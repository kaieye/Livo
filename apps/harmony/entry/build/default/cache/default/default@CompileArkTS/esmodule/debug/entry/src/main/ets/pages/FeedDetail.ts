if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface FeedDetail_Params {
    feedId?: string;
    feed?: FeedCardModel | undefined;
    entries?: EntryCardModel[];
    isRefreshing?: boolean;
    theme?: ThemePalette;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import type { EntryCardModel, FeedCardModel } from '../common/models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
class FeedDetail extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__feedId = new ObservedPropertySimplePU('', this, "feedId");
        this.__feed = new ObservedPropertyObjectPU(undefined, this, "feed");
        this.__entries = new ObservedPropertyObjectPU([], this, "entries");
        this.__isRefreshing = new ObservedPropertySimplePU(false, this, "isRefreshing");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: FeedDetail_Params) {
        if (params.feedId !== undefined) {
            this.feedId = params.feedId;
        }
        if (params.feed !== undefined) {
            this.feed = params.feed;
        }
        if (params.entries !== undefined) {
            this.entries = params.entries;
        }
        if (params.isRefreshing !== undefined) {
            this.isRefreshing = params.isRefreshing;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: FeedDetail_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__feedId.purgeDependencyOnElmtId(rmElmtId);
        this.__feed.purgeDependencyOnElmtId(rmElmtId);
        this.__entries.purgeDependencyOnElmtId(rmElmtId);
        this.__isRefreshing.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feedId.aboutToBeDeleted();
        this.__feed.aboutToBeDeleted();
        this.__entries.aboutToBeDeleted();
        this.__isRefreshing.aboutToBeDeleted();
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
    private __feed: ObservedPropertyObjectPU<FeedCardModel | undefined>;
    get feed() {
        return this.__feed.get();
    }
    set feed(newValue: FeedCardModel | undefined) {
        this.__feed.set(newValue);
    }
    private __entries: ObservedPropertyObjectPU<EntryCardModel[]>;
    get entries() {
        return this.__entries.get();
    }
    set entries(newValue: EntryCardModel[]) {
        this.__entries.set(newValue);
    }
    private __isRefreshing: ObservedPropertySimplePU<boolean>;
    get isRefreshing() {
        return this.__isRefreshing.get();
    }
    set isRefreshing(newValue: boolean) {
        this.__isRefreshing.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        console.info('Livo Harmony FeedDetail aboutToAppear');
        const params = router.getParams() as Record<string, string>;
        if (params && params.feedId) {
            this.feedId = params.feedId;
            void this.loadData();
        }
    }
    private async loadData(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        if (this.feedId) {
            this.feed = await AppRepository.feedById(this.feedId);
            this.entries = await AppRepository.entriesByFeed(this.feedId);
        }
    }
    private async refreshFeed(): Promise<void> {
        if (!this.feedId)
            return;
        this.isRefreshing = true;
        try {
            await AppRepository.refreshFeed(this.feedId);
            this.feed = await AppRepository.feedById(this.feedId);
            this.entries = await AppRepository.entriesByFeed(this.feedId);
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
            // Feed 信息行（在单独的源页面里，也可隐藏 sources 名字，但展示时间比较好）
            Row.create({ space: 6 });
            // Feed 信息行（在单独的源页面里，也可隐藏 sources 名字，但展示时间比较好）
            Row.width('100%');
        }, Row);
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
        // Feed 信息行（在单独的源页面里，也可隐藏 sources 名字，但展示时间比较好）
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
    private PageHeader(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 16 });
            Row.width('100%');
            Row.padding({ left: 12, right: 16, top: 12, bottom: 12 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125832663, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(28);
            SymbolGlyph.fontColor([this.theme.textPrimary]);
            SymbolGlyph.padding(8);
            SymbolGlyph.clickEffect({ level: ClickEffectLevel.LIGHT });
            SymbolGlyph.onClick(() => router.back());
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.feed) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.feed.imageUrl) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Image.create(this.feed.imageUrl);
                                    Image.width(36);
                                    Image.height(36);
                                    Image.borderRadius(18);
                                    Image.objectFit(ImageFit.Cover);
                                }, Image);
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Row.create();
                                    Row.width(36);
                                    Row.height(36);
                                    Row.borderRadius(18);
                                    Row.backgroundColor(this.theme.accent);
                                    Row.justifyContent(FlexAlign.Center);
                                }, Row);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.feed.title.charAt(0).toUpperCase());
                                    Text.fontSize(18);
                                    Text.fontWeight(FontWeight.Bold);
                                    Text.fontColor('#ffffff');
                                }, Text);
                                Text.pop();
                                Row.pop();
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.feed.title);
                        Text.fontSize(20);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('加载中');
                        Text.fontSize(20);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.PageHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.feed) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        List.create({ space: 12 });
                        List.width('100%');
                        List.layoutWeight(1);
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
                        };
                        const deepRenderFunction = (elmtId, isInitialRender) => {
                            itemCreation(elmtId, isInitialRender);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Column.create({ space: 10 });
                                Column.padding({ left: 18, right: 18, bottom: 12 });
                                Column.alignItems(HorizontalAlign.Start);
                            }, Column);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                If.create();
                                if (this.feed.description) {
                                    this.ifElseBranchUpdateFunction(0, () => {
                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                            Text.create(this.feed.description);
                                            Text.fontSize(14);
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
                                Row.create();
                                Row.width('100%');
                            }, Row);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(`${this.entries.length} 篇文章`);
                                Text.fontSize(13);
                                Text.fontColor(this.theme.textMuted);
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
                                Button.onClick(() => { void this.refreshFeed(); });
                            }, Button);
                            Button.pop();
                            Row.pop();
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
                                };
                                const deepRenderFunction = (elmtId, isInitialRender) => {
                                    itemCreation(elmtId, isInitialRender);
                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                        Column.create();
                                    }, Column);
                                    this.EntryCard.bind(this)(entry);
                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                        If.create();
                                        if (index < this.entries.length - 1) {
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
                        this.forEachUpdateFunction(elmtId, this.entries, forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
                    }, ForEach);
                    ForEach.pop();
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
                                Row.height(40);
                                Row.width('100%');
                            }, Row);
                            Row.pop();
                            ListItem.pop();
                        };
                        this.observeComponentCreation2(itemCreation2, ListItem);
                        ListItem.pop();
                    }
                    List.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.layoutWeight(1);
                        Column.justifyContent(FlexAlign.Center);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        LoadingProgress.create();
                        LoadingProgress.width(48);
                        LoadingProgress.height(48);
                        LoadingProgress.color(this.theme.accent);
                    }, LoadingProgress);
                    Column.pop();
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
        return "FeedDetail";
    }
}
registerNamedRoute(() => new FeedDetail(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/FeedDetail", pageFullPath: "entry/src/main/ets/pages/FeedDetail", integratedHsp: "false", moduleType: "followWithHap" });

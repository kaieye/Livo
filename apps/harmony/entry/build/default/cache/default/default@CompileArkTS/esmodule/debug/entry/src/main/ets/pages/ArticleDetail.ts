if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ArticleDetail_Params {
    entry?: ArticleDetailModel;
    actionHint?: string;
    aiSummary?: string;
    aiEnabled?: boolean;
    theme?: ThemePalette;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { ArticleAssistService } from "@bundle:com.livo.harmony/entry/ets/common/services/ArticleAssistService";
import type { ArticleDetailModel } from '../common/models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
class ArticleDetail extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__entry = new ObservedPropertyObjectPU(undefined, this, "entry");
        this.__actionHint = new ObservedPropertySimplePU('', this, "actionHint");
        this.__aiSummary = new ObservedPropertySimplePU('', this, "aiSummary");
        this.__aiEnabled = new ObservedPropertySimplePU(false, this, "aiEnabled");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: ArticleDetail_Params) {
        if (params.entry !== undefined) {
            this.entry = params.entry;
        }
        if (params.actionHint !== undefined) {
            this.actionHint = params.actionHint;
        }
        if (params.aiSummary !== undefined) {
            this.aiSummary = params.aiSummary;
        }
        if (params.aiEnabled !== undefined) {
            this.aiEnabled = params.aiEnabled;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: ArticleDetail_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__entry.purgeDependencyOnElmtId(rmElmtId);
        this.__actionHint.purgeDependencyOnElmtId(rmElmtId);
        this.__aiSummary.purgeDependencyOnElmtId(rmElmtId);
        this.__aiEnabled.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__entry.aboutToBeDeleted();
        this.__actionHint.aboutToBeDeleted();
        this.__aiSummary.aboutToBeDeleted();
        this.__aiEnabled.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __entry?: ObservedPropertyObjectPU<ArticleDetailModel>;
    get entry() {
        return this.__entry.get();
    }
    set entry(newValue: ArticleDetailModel) {
        this.__entry.set(newValue);
    }
    private __actionHint: ObservedPropertySimplePU<string>;
    get actionHint() {
        return this.__actionHint.get();
    }
    set actionHint(newValue: string) {
        this.__actionHint.set(newValue);
    }
    private __aiSummary: ObservedPropertySimplePU<string>;
    get aiSummary() {
        return this.__aiSummary.get();
    }
    set aiSummary(newValue: string) {
        this.__aiSummary.set(newValue);
    }
    private __aiEnabled: ObservedPropertySimplePU<boolean>;
    get aiEnabled() {
        return this.__aiEnabled.get();
    }
    set aiEnabled(newValue: boolean) {
        this.__aiEnabled.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadEntry(true);
    }
    private entryId(): string {
        const params = router.getParams() as Record<string, string>;
        return params?.entryId ?? '';
    }
    private async loadEntry(markRead: boolean): Promise<void> {
        const entryId = this.entryId();
        if (!entryId) {
            this.entry = undefined;
            return;
        }
        if (markRead) {
            await AppRepository.markRead(entryId, true);
        }
        this.entry = await AppRepository.entryById(entryId);
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        this.aiEnabled = settings.aiSummaryEnabled;
        this.aiSummary = this.entry
            ? ArticleAssistService.summarize(this.entry.title, this.entry.summary, this.entry.contentParagraphs)
            : '';
        this.actionHint = markRead ? '已标记为已读' : '内容已刷新';
    }
    private async toggleStar(): Promise<void> {
        const entryId = this.entryId();
        if (!entryId) {
            return;
        }
        await AppRepository.toggleStar(entryId);
        await this.loadEntry(false);
        this.actionHint = '收藏状态已更新';
    }
    private async toggleRead(): Promise<void> {
        const entryId = this.entryId();
        if (!entryId || !this.entry) {
            return;
        }
        await AppRepository.markRead(entryId, !this.entry.isRead);
        await this.loadEntry(false);
        this.actionHint = this.entry?.isRead ? '已标记为已读' : '已标记为未读';
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 18, right: 18, top: 20, bottom: 12 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('返回');
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.clickEffect({ level: ClickEffectLevel.LIGHT });
            Button.onClick(() => router.back());
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('收藏');
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.entry?.isStarred ? this.theme.accent : this.theme.textPrimary);
            Button.clickEffect({ level: ClickEffectLevel.LIGHT });
            Button.onClick(() => { void this.toggleStar(); });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.entry?.isRead ? '未读' : '已读');
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.clickEffect({ level: ClickEffectLevel.LIGHT });
            Button.onClick(() => { void this.toggleRead(); });
        }, Button);
        Button.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.scrollBar(BarState.Off);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.width('100%');
            Column.padding({ left: 18, right: 18, bottom: 48 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.entry) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.title);
                        Text.fontSize(30);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`${this.entry!.author} · ${this.entry!.publishedLabel} · ${this.entry!.readingLabel}`);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.actionHint);
                        Text.fontSize(12);
                        Text.fontColor(this.theme.accent);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.aiEnabled && this.aiSummary) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create({ space: 8 });
                                    Column.width('100%');
                                    Column.alignItems(HorizontalAlign.Start);
                                    Column.padding(16);
                                    Column.backgroundColor(this.theme.surface);
                                    Column.borderRadius(18);
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('摘要增强');
                                    Text.fontSize(14);
                                    Text.fontWeight(FontWeight.Medium);
                                    Text.fontColor(this.theme.textPrimary);
                                }, Text);
                                Text.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.aiSummary);
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
                            });
                        }
                    }, If);
                    If.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.viewLabel);
                        Text.fontSize(11);
                        Text.fontColor(this.theme.isDark ? '#000000' : '#FFFFFF');
                        Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                        Text.backgroundColor(this.entry!.viewBadgeColor);
                        Text.borderRadius(999);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.feedTitle);
                        Text.fontSize(12);
                        Text.fontColor(this.theme.accent);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.isStarred ? '已收藏' : '未收藏');
                        Text.fontSize(12);
                        Text.fontColor(this.theme.textMuted);
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const tag = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(tag);
                                Text.fontSize(12);
                                Text.fontColor(this.theme.textSecondary);
                                Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                                Text.backgroundColor(this.theme.elevated);
                                Text.borderRadius(999);
                            }, Text);
                            Text.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.entry!.tags, forEachItemGenFunction, (tag: string) => tag, false, false);
                    }, ForEach);
                    ForEach.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 18 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding({ top: 12, bottom: 12 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.entry!.summary) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.entry!.summary);
                                    Text.fontSize(17);
                                    Text.lineHeight(28);
                                    Text.fontColor(this.theme.textPrimary);
                                    Text.fontWeight(FontWeight.Medium);
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
                        const forEachItemGenFunction = _item => {
                            const paragraph = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(paragraph);
                                Text.fontSize(17);
                                Text.lineHeight(30);
                                Text.fontColor(this.theme.textSecondary);
                            }, Text);
                            Text.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.entry!.contentParagraphs, forEachItemGenFunction, (paragraph: string, index: number) => `${index}-${paragraph}`, false, true);
                    }, ForEach);
                    ForEach.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`原始来源：${this.entry!.siteUrl}`);
                        Text.fontSize(13);
                        Text.fontColor(this.theme.textMuted);
                        Text.margin({ top: 18 });
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.padding(20);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(24);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('未找到内容');
                        Text.fontSize(24);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('请从订阅页重新进入一个条目。');
                        Text.fontSize(15);
                        Text.fontColor(this.theme.textSecondary);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
        Scroll.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "ArticleDetail";
    }
}
registerNamedRoute(() => new ArticleDetail(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/ArticleDetail", pageFullPath: "entry/src/main/ets/pages/ArticleDetail", integratedHsp: "false", moduleType: "followWithHap" });

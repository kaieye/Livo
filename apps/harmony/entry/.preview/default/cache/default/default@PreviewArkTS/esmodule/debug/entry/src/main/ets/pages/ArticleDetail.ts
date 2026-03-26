if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ArticleDetail_Params {
    entry?: ArticleDetailModel;
    actionHint?: string;
    aiSummary?: string;
    aiEnabled?: boolean;
}
import router from "@ohos:router";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { ArticleAssistService } from "@bundle:com.livo.harmony/entry/ets/common/services/ArticleAssistService";
import type { ArticleDetailModel } from '../common/models/LivoModels';
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
    }
    updateStateVars(params: ArticleDetail_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__entry.purgeDependencyOnElmtId(rmElmtId);
        this.__actionHint.purgeDependencyOnElmtId(rmElmtId);
        this.__aiSummary.purgeDependencyOnElmtId(rmElmtId);
        this.__aiEnabled.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__entry.aboutToBeDeleted();
        this.__actionHint.aboutToBeDeleted();
        this.__aiSummary.aboutToBeDeleted();
        this.__aiEnabled.aboutToBeDeleted();
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
            Column.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(67:5)", "entry");
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#F4F7FB');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(68:7)", "entry");
            Row.width('100%');
            Row.padding({ left: 18, right: 18, top: 20, bottom: 12 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('返回');
            Button.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(69:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor('#E2E8F0');
            Button.fontColor('#0F172A');
            Button.onClick(() => router.back());
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(75:9)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('收藏');
            Button.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(77:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor('#E2E8F0');
            Button.fontColor('#0F172A');
            Button.onClick(() => { void this.toggleStar(); });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.entry?.isRead ? '未读' : '已读');
            Button.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(83:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor('#E2E8F0');
            Button.fontColor('#0F172A');
            Button.onClick(() => { void this.toggleRead(); });
        }, Button);
        Button.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(92:7)", "entry");
            Scroll.scrollBar(BarState.Off);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(93:9)", "entry");
            Column.width('100%');
            Column.padding({ left: 18, right: 18, bottom: 24 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.entry) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.title);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(95:13)", "entry");
                        Text.fontSize(30);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#0F172A');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`${this.entry!.author} · ${this.entry!.publishedLabel} · ${this.entry!.readingLabel}`);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(100:13)", "entry");
                        Text.fontSize(14);
                        Text.fontColor('#64748B');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.actionHint);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(104:13)", "entry");
                        Text.fontSize(12);
                        Text.fontColor('#2563EB');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.aiEnabled && this.aiSummary) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Column.create({ space: 8 });
                                    Column.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(109:15)", "entry");
                                    Column.width('100%');
                                    Column.padding(14);
                                    Column.backgroundColor('#EFF6FF');
                                    Column.borderRadius(18);
                                }, Column);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create('摘要增强');
                                    Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(110:17)", "entry");
                                    Text.fontSize(14);
                                    Text.fontWeight(FontWeight.Medium);
                                    Text.fontColor('#0F172A');
                                }, Text);
                                Text.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.aiSummary);
                                    Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(115:17)", "entry");
                                    Text.fontSize(13);
                                    Text.lineHeight(20);
                                    Text.fontColor('#475569');
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
                        Row.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(126:13)", "entry");
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.viewLabel);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(127:15)", "entry");
                        Text.fontSize(11);
                        Text.fontColor('#0F172A');
                        Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                        Text.backgroundColor(this.entry!.viewBadgeColor);
                        Text.borderRadius(999);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.feedTitle);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(134:15)", "entry");
                        Text.fontSize(12);
                        Text.fontColor('#2563EB');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.isStarred ? '已收藏' : '未收藏');
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(138:15)", "entry");
                        Text.fontSize(12);
                        Text.fontColor(this.entry!.isStarred ? '#B45309' : '#64748B');
                    }, Text);
                    Text.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                        Row.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(143:13)", "entry");
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const tag = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(tag);
                                Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(145:17)", "entry");
                                Text.fontSize(12);
                                Text.fontColor('#1D4ED8');
                                Text.padding({ left: 10, right: 10, top: 6, bottom: 6 });
                                Text.backgroundColor('#DBEAFE');
                                Text.borderRadius(999);
                            }, Text);
                            Text.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.entry!.tags, forEachItemGenFunction, (tag: string) => tag, false, false);
                    }, ForEach);
                    ForEach.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 14 });
                        Column.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(154:13)", "entry");
                        Column.width('100%');
                        Column.padding(20);
                        Column.backgroundColor('#FFFFFF');
                        Column.borderRadius(24);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.entry!.summary);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(155:15)", "entry");
                        Text.fontSize(17);
                        Text.lineHeight(28);
                        Text.fontColor('#334155');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const paragraph = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(paragraph);
                                Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(161:17)", "entry");
                                Text.fontSize(16);
                                Text.lineHeight(28);
                                Text.fontColor('#475569');
                            }, Text);
                            Text.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.entry!.contentParagraphs, forEachItemGenFunction, (paragraph: string, index: number) => `${index}-${paragraph}`, false, true);
                    }, ForEach);
                    ForEach.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`原始来源：${this.entry!.siteUrl}`);
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(167:15)", "entry");
                        Text.fontSize(13);
                        Text.fontColor('#64748B');
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(176:13)", "entry");
                        Column.width('100%');
                        Column.padding(20);
                        Column.backgroundColor('#FFFFFF');
                        Column.borderRadius(24);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('未找到内容');
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(177:15)", "entry");
                        Text.fontSize(24);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#0F172A');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('请从订阅页重新进入一个条目。');
                        Text.debugLine("entry/src/main/ets/pages/ArticleDetail.ets(182:15)", "entry");
                        Text.fontSize(15);
                        Text.fontColor('#64748B');
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

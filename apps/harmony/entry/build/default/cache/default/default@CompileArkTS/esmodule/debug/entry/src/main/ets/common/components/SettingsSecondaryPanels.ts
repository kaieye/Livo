if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AboutSettingsPanel_Params {
    theme?: ThemePalette;
}
interface PrivacySettingsPanel_Params {
    theme?: ThemePalette;
}
interface DataControlSettingsPanel_Params {
    config?: HarmonySettings;
    theme?: ThemePalette;
    onSettingsChange?: (settings: HarmonySettings) => void;
}
interface FavoritesPanel_Params {
    theme?: ThemePalette;
    starredEntries?: EntryCardModel[];
    isLoading?: boolean;
}
interface GeneralSettingsPanel_Params {
    config?: HarmonySettings;
    theme?: ThemePalette;
    saveHint?: string;
    onSettingsChange?: (settings: HarmonySettings) => void;
}
import { openArticleDetail } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { DEFAULT_HARMONY_SETTINGS } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { EntryCardModel, HarmonySettings } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
const PANEL_ROW_MIN_HEIGHT: number = 56;
const PANEL_ICON_SIZE: number = 22;
const PANEL_TITLE_SIZE: number = 15;
const PANEL_SUBTITLE_SIZE: number = 12;
const PANEL_HINT_SIZE: number = 12;
const PANEL_HANDLE_TOP_PADDING: number = 10;
const PANEL_HANDLE_BOTTOM_PADDING: number = 8;
const PANEL_ROW_TEXT_SPACING: number = 2;
const PANEL_GROUP_SPACING: number = 14;
const PANEL_SECTION_SPACING: number = 2;
const PANEL_ROW_PADDING_HORIZONTAL: number = 12;
const PANEL_ROW_PADDING_VERTICAL: number = 6;
function SettingsPanelHeader(title: string, theme: ThemePalette, parent = null) {
    {
        (parent ? parent : this).observeComponentCreation2((elmtId, isInitialRender) => {
            if (isInitialRender) {
                let componentCall = new PageHeader(parent ? parent : this, {
                    title,
                    theme,
                    titleSize: 20,
                    topPadding: 0,
                    bottomPadding: 0,
                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsSecondaryPanels.ets", line: 24, col: 3 });
                ViewPU.create(componentCall);
                let paramsLambda = () => {
                    return {
                        title,
                        theme,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    };
                };
                componentCall.paramsGenerator_ = paramsLambda;
            }
            else {
                (parent ? parent : this).updateStateVarsOfChildByElmtId(elmtId, {
                    title,
                    theme,
                    titleSize: 20,
                    topPadding: 0,
                    bottomPadding: 0
                });
            }
        }, { name: "PageHeader" });
    }
}
export class GeneralSettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__config = new ObservedPropertyObjectPU(DEFAULT_HARMONY_SETTINGS, this, "config");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__saveHint = new ObservedPropertySimplePU('通用设置将保存到本地', this, "saveHint");
        this.onSettingsChange = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: GeneralSettingsPanel_Params) {
        if (params.config !== undefined) {
            this.config = params.config;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.saveHint !== undefined) {
            this.saveHint = params.saveHint;
        }
        if (params.onSettingsChange !== undefined) {
            this.onSettingsChange = params.onSettingsChange;
        }
    }
    updateStateVars(params: GeneralSettingsPanel_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__config.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__saveHint.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__config.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__saveHint.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __config: ObservedPropertyObjectPU<HarmonySettings>;
    get config() {
        return this.__config.get();
    }
    set config(newValue: HarmonySettings) {
        this.__config.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __saveHint: ObservedPropertySimplePU<string>;
    get saveHint() {
        return this.__saveHint.get();
    }
    set saveHint(newValue: string) {
        this.__saveHint.set(newValue);
    }
    private onSettingsChange: (settings: HarmonySettings) => void;
    aboutToAppear(): void {
        void this.loadSettings();
    }
    private async loadSettings(): Promise<void> {
        this.config = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(this.config);
        this.saveHint = '已加载通用配置';
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        SettingsPanelHeader.bind(this)('通用', this.theme);
    }
    private InfoRow(symbol: Resource, title: string, subtitle: string, hint: string, iconDelay: number = 0, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({
                left: PANEL_ROW_PADDING_HORIZONTAL,
                right: PANEL_ROW_PADDING_HORIZONTAL,
                top: PANEL_ROW_PADDING_VERTICAL,
                bottom: PANEL_ROW_PADDING_VERTICAL,
            });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(symbol);
            SymbolGlyph.fontSize(PANEL_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(iconDelay));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(subtitle);
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(hint);
            Text.fontSize(PANEL_HINT_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Row.pop();
    }
    private DividerLine(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('92%');
            Row.height(0.5);
            Row.backgroundColor(this.theme.divider);
        }, Row);
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(40));
        }, Column);
        this.InfoRow.bind(this)({ "id": 125832110, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '应用语言', '当前界面语言', this.config.language, 0);
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)({ "id": 125831551, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '刷新间隔', '后台自动刷新频率', `${this.config.refreshIntervalMinutes} 分钟`, 1);
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)({ "id": 125831976, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '默认订阅源', '远程订阅源地址', this.config.remoteFeedUrl ? '已配置' : '未配置', 2);
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(28);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
export class FavoritesPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__starredEntries = new ObservedPropertyObjectPU([], this, "starredEntries");
        this.__isLoading = new ObservedPropertySimplePU(true, this, "isLoading");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: FavoritesPanel_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.starredEntries !== undefined) {
            this.starredEntries = params.starredEntries;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
    }
    updateStateVars(params: FavoritesPanel_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__starredEntries.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
        this.__starredEntries.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
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
    private __starredEntries: ObservedPropertyObjectPU<EntryCardModel[]>;
    get starredEntries() {
        return this.__starredEntries.get();
    }
    set starredEntries(newValue: EntryCardModel[]) {
        this.__starredEntries.set(newValue);
    }
    private __isLoading: ObservedPropertySimplePU<boolean>;
    get isLoading() {
        return this.__isLoading.get();
    }
    set isLoading(newValue: boolean) {
        this.__isLoading.set(newValue);
    }
    aboutToAppear(): void {
        this.theme = ThemeService.currentPalette();
        void this.loadStarredEntries();
    }
    private async loadStarredEntries(): Promise<void> {
        this.isLoading = true;
        try {
            this.starredEntries = await AppRepository.starredEntries();
        }
        finally {
            this.isLoading = false;
        }
    }
    private async toggleStar(entryId: string): Promise<void> {
        await AppRepository.toggleStar(entryId);
        this.starredEntries = this.starredEntries.filter((entry: EntryCardModel) => entry.id !== entryId);
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        SettingsPanelHeader.bind(this)('收藏', this.theme);
    }
    private StatusCard(symbol: Resource, title: string, subtitle: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({
                left: PANEL_ROW_PADDING_HORIZONTAL,
                right: PANEL_ROW_PADDING_HORIZONTAL,
                top: PANEL_ROW_PADDING_VERTICAL,
                bottom: PANEL_ROW_PADDING_VERTICAL,
            });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(symbol);
            SymbolGlyph.fontSize(PANEL_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(subtitle);
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
    }
    private EntryCard(entry: EntryCardModel, index: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding(16);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.shadow({
                radius: this.theme.isDark ? 10 : 14,
                color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
                offsetX: 0,
                offsetY: 4,
            });
            Column.transition(livoMotion.enterSoft(index * 20 + 40));
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => {
                void openArticleDetail(entry.id);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 6 });
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.feedTitle);
            Text.fontSize(12);
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
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831521, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(18);
            SymbolGlyph.fontColor(['#F59E0B']);
            SymbolGlyph.padding(4);
            SymbolGlyph.clickEffect({ level: ClickEffectLevel.LIGHT });
            SymbolGlyph.onClick(() => {
                void this.toggleStar(entry.id);
            });
        }, SymbolGlyph);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.title);
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
            Text.width('100%');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (entry.summary) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(entry.summary);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(2);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.width('100%');
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
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(20));
        }, Column);
        this.StatusCard.bind(this)({ "id": 125831521, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '收藏概览', this.isLoading
            ? '正在整理你已收藏的文章'
            : this.starredEntries.length > 0
                ? `当前共收藏 ${this.starredEntries.length} 条内容`
                : '还没有收藏任何内容');
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isLoading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_LG);
                        Column.border({ width: 0.8, color: this.theme.divider });
                        Column.transition(livoMotion.enterSoft(40));
                    }, Column);
                    this.StatusCard.bind(this)({ "id": 125831551, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '正在加载收藏', '请稍等，Livo 正在同步你的收藏列表');
                    Column.pop();
                });
            }
            else if (this.starredEntries.length === 0) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_LG);
                        Column.border({ width: 0.8, color: this.theme.divider });
                        Column.transition(livoMotion.enterSoft(40));
                    }, Column);
                    this.StatusCard.bind(this)({ "id": 125831520, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '暂无收藏内容', '在文章详情里点亮星标后，会出现在这里');
                    Column.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 12 });
                        Column.width('100%');
                        Column.padding({ top: 8 });
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const entry = _item;
                            this.EntryCard.bind(this)(entry, index);
                        };
                        this.forEachUpdateFunction(elmtId, this.starredEntries, forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(28);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
export class DataControlSettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__config = new ObservedPropertyObjectPU(DEFAULT_HARMONY_SETTINGS, this, "config");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.onSettingsChange = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: DataControlSettingsPanel_Params) {
        if (params.config !== undefined) {
            this.config = params.config;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.onSettingsChange !== undefined) {
            this.onSettingsChange = params.onSettingsChange;
        }
    }
    updateStateVars(params: DataControlSettingsPanel_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__config.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__config.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __config: ObservedPropertyObjectPU<HarmonySettings>;
    get config() {
        return this.__config.get();
    }
    set config(newValue: HarmonySettings) {
        this.__config.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private onSettingsChange: (settings: HarmonySettings) => void;
    aboutToAppear(): void {
        void this.loadSettings();
    }
    private async loadSettings(): Promise<void> {
        this.config = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(this.config);
    }
    private syncSettings(next: HarmonySettings): void {
        this.config = next;
        this.onSettingsChange(next);
        void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
            this.config = saved;
            this.onSettingsChange(saved);
            void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
                this.theme = palette;
            });
        });
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        SettingsPanelHeader.bind(this)('数据控制', this.theme);
    }
    private ToggleRow(symbol: Resource, title: string, subtitle: string, checked: boolean, onToggle: () => void, iconDelay: number = 0, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({
                left: PANEL_ROW_PADDING_HORIZONTAL,
                right: PANEL_ROW_PADDING_HORIZONTAL,
                top: PANEL_ROW_PADDING_VERTICAL,
                bottom: PANEL_ROW_PADDING_VERTICAL,
            });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.onClick(() => onToggle());
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(symbol);
            SymbolGlyph.fontSize(PANEL_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(iconDelay));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(subtitle);
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: checked });
            Toggle.selectedColor(this.theme.accent);
            Toggle.switchPointColor('#FFFFFF');
            Toggle.hitTestBehavior(HitTestMode.None);
        }, Toggle);
        Toggle.pop();
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(40));
        }, Column);
        this.ToggleRow.bind(this)({ "id": 125831583, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '图片代理', '通过代理加载远程图片资源', this.config.imageProxyEnabled, () => {
            const nextSettings: HarmonySettings = {
                autoRefresh: this.config.autoRefresh,
                aiSummaryEnabled: this.config.aiSummaryEnabled,
                imageProxyEnabled: !this.config.imageProxyEnabled,
                refreshIntervalMinutes: this.config.refreshIntervalMinutes,
                themeMode: this.config.themeMode,
                themeAccent: this.config.themeAccent,
                language: this.config.language,
                remoteFeedUrl: this.config.remoteFeedUrl,
            };
            this.syncSettings(nextSettings);
        }, 0);
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(28);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
export class PrivacySettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: PrivacySettingsPanel_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: PrivacySettingsPanel_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
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
    aboutToAppear(): void {
        void this.loadTheme();
    }
    private async loadTheme(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.transition(livoMotion.enterRise(20));
        }, Column);
        SettingsPanelHeader.bind(this)('隐私', this.theme);
        Column.pop();
    }
    private InfoRow(symbol: Resource, title: string, subtitle: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({ left: PANEL_ROW_PADDING_HORIZONTAL, right: PANEL_ROW_PADDING_HORIZONTAL, top: 10, bottom: 10 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(symbol);
            SymbolGlyph.fontSize(PANEL_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(subtitle);
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.lineHeight(18);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
    }
    private DividerLine(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('92%');
            Row.height(0.5);
            Row.backgroundColor(this.theme.divider);
        }, Row);
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
        }, Column);
        this.InfoRow.bind(this)({ "id": 125832264, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '本地优先', '订阅源、文章状态与设置会优先保存在本机，不需要登录即可使用。');
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)({ "id": 125831976, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '网络请求', '仅在刷新订阅、发现内容或加载远程媒体时才会访问网络。');
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)({ "id": 125831583, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '代理与媒体', '如果你启用了图片代理，远程图片请求会经过代理地址再加载。');
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(28);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}
export class AboutSettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AboutSettingsPanel_Params) {
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: AboutSettingsPanel_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__theme.aboutToBeDeleted();
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
    aboutToAppear(): void {
        void this.loadTheme();
    }
    private async loadTheme(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
    }
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
            Column.padding({ top: PANEL_HANDLE_TOP_PADDING, bottom: PANEL_HANDLE_BOTTOM_PADDING });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(40);
            Row.height(5);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.dragHandle);
        }, Row);
        Row.pop();
        Column.pop();
    }
    private PanelHeader(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.transition(livoMotion.enterRise(20));
        }, Column);
        SettingsPanelHeader.bind(this)('关于', this.theme);
        Column.pop();
    }
    private InfoRow(title: string, value: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({ left: PANEL_ROW_PADDING_HORIZONTAL, right: PANEL_ROW_PADDING_HORIZONTAL, top: 10, bottom: 10 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(value);
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Row.pop();
    }
    private DividerLine(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('92%');
            Row.height(0.5);
            Row.backgroundColor(this.theme.divider);
        }, Row);
        Row.pop();
    }
    private SummaryCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: PANEL_ROW_MIN_HEIGHT });
            Row.padding({
                left: PANEL_ROW_PADDING_HORIZONTAL,
                right: PANEL_ROW_PADDING_HORIZONTAL,
                top: PANEL_ROW_PADDING_VERTICAL,
                bottom: PANEL_ROW_PADDING_VERTICAL,
            });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125832646, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(PANEL_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Harmony 端信息');
            Text.fontSize(PANEL_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('当前页面展示应用与项目的基础信息');
            Text.fontSize(PANEL_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        Column.pop();
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
            Scroll.edgeEffect(EdgeEffect.Spring);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: PANEL_SECTION_SPACING });
            Column.width('100%');
            Column.constraintSize({ minHeight: '100%' });
            Column.justifyContent(FlexAlign.Start);
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 });
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(20));
        }, Column);
        this.SummaryCard.bind(this)();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
        }, Column);
        this.InfoRow.bind(this)('应用名称', 'Livo');
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)('Harmony 端', 'ArkTS / ArkUI');
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)('数据策略', '本地优先');
        this.DividerLine.bind(this)();
        this.InfoRow.bind(this)('项目状态', '开发中');
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(28);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
        Scroll.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

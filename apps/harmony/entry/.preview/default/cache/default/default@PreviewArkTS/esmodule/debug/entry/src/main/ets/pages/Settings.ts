if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Settings_Params {
    config?: HarmonySettings;
    saveHint?: string;
    theme?: ThemePalette;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { DEFAULT_HARMONY_SETTINGS } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { HarmonySettings, ThemeMode } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
interface SettingItem {
    title: string;
    icon: string;
    color: string;
}
const PRIMARY_GROUP: SettingItem[] = [
    { title: '通用', icon: '◎', color: '#FF4571' },
    { title: '外观', icon: '◔', color: '#8B5CF6' },
    { title: '数据控制', icon: '◫', color: '#3B82F6' },
    { title: '账户', icon: '◉', color: '#FF7A1A' },
];
const SECOND_GROUP: SettingItem[] = [
    { title: '自动化', icon: '✦', color: '#9333EA' },
    { title: '列表', icon: '◌', color: '#0EA5E9' },
];
const THIRD_GROUP: SettingItem[] = [
    { title: '订阅', icon: '◍', color: '#FF7A1A' },
];
const FOURTH_GROUP: SettingItem[] = [
    { title: '隐私', icon: '◈', color: '#6366F1' },
    { title: '关于', icon: '⬢', color: '#FBBF24' },
];
class Settings extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__config = new ObservedPropertyObjectPU(DEFAULT_HARMONY_SETTINGS, this, "config");
        this.__saveHint = new ObservedPropertySimplePU('设置将写入本地 Preferences', this, "saveHint");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.darkPalette(), this, "theme");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Settings_Params) {
        if (params.config !== undefined) {
            this.config = params.config;
        }
        if (params.saveHint !== undefined) {
            this.saveHint = params.saveHint;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
    }
    updateStateVars(params: Settings_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__config.purgeDependencyOnElmtId(rmElmtId);
        this.__saveHint.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__config.aboutToBeDeleted();
        this.__saveHint.aboutToBeDeleted();
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
    private __saveHint: ObservedPropertySimplePU<string>;
    get saveHint() {
        return this.__saveHint.get();
    }
    set saveHint(newValue: string) {
        this.__saveHint.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    aboutToAppear(): void {
        void this.loadSettings();
    }
    private async loadSettings(): Promise<void> {
        this.config = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(this.config);
        this.saveHint = '已加载本地配置';
    }
    private syncSettings(next: HarmonySettings): void {
        this.config = next;
        void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
            this.config = saved;
            void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
                this.theme = palette;
            });
            this.saveHint = '已保存到本地 Preferences';
        }).catch((error: Error) => {
            this.saveHint = `保存失败：${error.message}`;
        });
    }
    private themeLabel(): string {
        switch (this.config.themeMode) {
            case 'light':
                return '浅色';
            case 'dark':
                return '深色';
            default:
                return '跟随系统';
        }
    }
    private quickToggleTheme(): void {
        const next: ThemeMode = this.config.themeMode === 'dark' ? 'light' : 'dark';
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: next,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private applyThemeMode(themeMode: ThemeMode): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private Hero(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.TopStart });
            Stack.debugLine("entry/src/main/ets/pages/Settings.ets(101:5)", "entry");
            Stack.width('100%');
            Stack.height(320);
            Stack.backgroundColor(this.theme.isDark ? '#131313' : '#D9C57A');
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 16 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(102:7)", "entry");
            Column.width('100%');
            Column.height(320);
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({ left: 18, right: 18 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(103:9)", "entry");
            Row.width('100%');
            Row.padding({ top: 16 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
            Blank.debugLine("entry/src/main/ets/pages/Settings.ets(104:11)", "entry");
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('编辑');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(105:11)", "entry");
            Text.fontSize(18);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 16 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(112:9)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/pages/Settings.ets(113:11)", "entry");
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(114:13)", "entry");
            Row.width(92);
            Row.height(92);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.28)');
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('L');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(120:13)", "entry");
            Text.fontSize(34);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.accentText);
        }, Text);
        Text.pop();
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Livo 用户');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(126:11)", "entry");
            Text.fontSize(30);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.themeLabel()} · ${this.config.language} · 每 ${this.config.refreshIntervalMinutes} 分钟刷新`);
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(131:11)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(17, 17, 17, 0.72)');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.saveHint);
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(135:11)", "entry");
            Text.fontSize(12);
            Text.fontColor(this.theme.isDark ? 'rgba(255, 255, 255, 0.64)' : 'rgba(17, 17, 17, 0.58)');
        }, Text);
        Text.pop();
        Column.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(147:7)", "entry");
            Row.width(260);
            Row.height(260);
            Row.borderRadius(999);
            Row.backgroundColor('rgba(250, 204, 21, 0.32)');
            Row.align(Alignment.TopEnd);
            Row.margin({ top: -30, right: -90 });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(155:7)", "entry");
            Row.width(260);
            Row.height(260);
            Row.borderRadius(999);
            Row.backgroundColor('rgba(250, 204, 21, 0.08)');
            Row.align(Alignment.TopStart);
            Row.margin({ top: -90, left: -120 });
        }, Row);
        Row.pop();
        Stack.pop();
    }
    private SettingRow(item: SettingItem, showDivider: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(170:5)", "entry");
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 16 });
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(171:7)", "entry");
            Row.width('100%');
            Row.padding({ left: 18, right: 18, top: 18, bottom: 18 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/pages/Settings.ets(172:9)", "entry");
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(173:11)", "entry");
            Row.width(44);
            Row.height(44);
            Row.borderRadius(12);
            Row.backgroundColor(item.color);
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(item.icon);
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(179:11)", "entry");
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.accentText);
        }, Text);
        Text.pop();
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(item.title);
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(185:9)", "entry");
            Text.fontSize(18);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('›');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(191:9)", "entry");
            Text.fontSize(24);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (showDivider) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Divider.create();
                        Divider.debugLine("entry/src/main/ets/pages/Settings.ets(199:9)", "entry");
                        Divider.strokeWidth(1);
                        Divider.color(this.theme.divider);
                        Divider.margin({ left: 78, right: 18 });
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
    private Group(items: SettingItem[], parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(210:5)", "entry");
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = (_item, index: number) => {
                const item = _item;
                this.SettingRow.bind(this)(item, index < items.length - 1);
            };
            this.forEachUpdateFunction(elmtId, items, forEachItemGenFunction, (item: SettingItem) => item.title, true, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    private QuickActions(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(222:5)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
            Column.padding(18);
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(24);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('快捷控制');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(223:7)", "entry");
            Text.fontSize(20);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(228:7)", "entry");
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('主题模式');
            Text.debugLine("entry/src/main/ets/pages/Settings.ets(229:9)", "entry");
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(234:9)", "entry");
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('浅色');
            Button.debugLine("entry/src/main/ets/pages/Settings.ets(235:11)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.config.themeMode === 'light' ? this.theme.accent : this.theme.elevated);
            Button.fontColor(this.config.themeMode === 'light' ? this.theme.accentText : this.theme.textPrimary);
            Button.onClick(() => this.applyThemeMode('light'));
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('深色');
            Button.debugLine("entry/src/main/ets/pages/Settings.ets(241:11)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.config.themeMode === 'dark' ? this.theme.accent : this.theme.elevated);
            Button.fontColor(this.config.themeMode === 'dark' ? this.theme.accentText : this.theme.textPrimary);
            Button.onClick(() => this.applyThemeMode('dark'));
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('跟随系统');
            Button.debugLine("entry/src/main/ets/pages/Settings.ets(247:11)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.config.themeMode === 'system' ? this.theme.accent : this.theme.elevated);
            Button.fontColor(this.config.themeMode === 'system' ? this.theme.accentText : this.theme.textPrimary);
            Button.onClick(() => this.applyThemeMode('system'));
        }, Button);
        Button.pop();
        Row.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.debugLine("entry/src/main/ets/pages/Settings.ets(257:7)", "entry");
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel(this.config.autoRefresh ? '关闭自动刷新' : '开启自动刷新');
            Button.debugLine("entry/src/main/ets/pages/Settings.ets(258:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.accent);
            Button.fontColor(this.theme.accentText);
            Button.onClick(() => {
                this.syncSettings({
                    autoRefresh: !this.config.autoRefresh,
                    aiSummaryEnabled: this.config.aiSummaryEnabled,
                    imageProxyEnabled: this.config.imageProxyEnabled,
                    refreshIntervalMinutes: this.config.refreshIntervalMinutes,
                    themeMode: this.config.themeMode,
                    language: this.config.language,
                    remoteFeedUrl: this.config.remoteFeedUrl,
                });
            });
        }, Button);
        Button.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Button.createWithLabel('切换主题');
            Button.debugLine("entry/src/main/ets/pages/Settings.ets(274:9)", "entry");
            Button.type(ButtonType.Capsule);
            Button.backgroundColor(this.theme.elevated);
            Button.fontColor(this.theme.textPrimary);
            Button.onClick(() => this.quickToggleTheme());
        }, Button);
        Button.pop();
        Row.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.debugLine("entry/src/main/ets/pages/Settings.ets(289:5)", "entry");
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Scroll.debugLine("entry/src/main/ets/pages/Settings.ets(290:7)", "entry");
            Scroll.scrollBar(BarState.Off);
            Scroll.backgroundColor(this.theme.background);
        }, Scroll);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 24 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(291:9)", "entry");
            Column.width('100%');
        }, Column);
        this.Hero.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 18 });
            Column.debugLine("entry/src/main/ets/pages/Settings.ets(294:11)", "entry");
            Column.width('100%');
            Column.padding({ left: 18, right: 18, bottom: 126 });
            Column.margin({ top: -18 });
        }, Column);
        this.Group.bind(this)(PRIMARY_GROUP);
        this.Group.bind(this)(SECOND_GROUP);
        this.Group.bind(this)(THIRD_GROUP);
        this.Group.bind(this)(FOURTH_GROUP);
        this.QuickActions.bind(this)();
        Column.pop();
        Column.pop();
        Scroll.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.align(Alignment.Bottom);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, { activeTab: 'settings', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Settings.ets", line: 310, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            activeTab: 'settings',
                            theme: this.theme
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        activeTab: 'settings', theme: this.theme
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
        return "Settings";
    }
}
registerNamedRoute(() => new Settings(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Settings", pageFullPath: "entry/src/main/ets/pages/Settings", integratedHsp: "false", moduleType: "followWithHap" });

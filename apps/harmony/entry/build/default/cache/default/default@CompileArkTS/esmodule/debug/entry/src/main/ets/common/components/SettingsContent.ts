if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface SettingsContent_Params {
    config?: HarmonySettings;
    saveHint?: string;
    theme?: ThemePalette;
    hasLoaded?: boolean;
    isLoading?: boolean;
    activeSheet?: SettingsSheetKey;
    showSettingsSheet?: boolean;
    storedActiveSheet?: SettingsSheetKey;
    settingsOverlayLevel?: number;
    showBottomTabs?: boolean;
    inheritedTheme?: ThemePalette;
    onThemeChange?: (theme: ThemePalette) => void;
    onReady?: () => void;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { AppearanceSettingsPanel } from "@bundle:com.livo.harmony/entry/ets/common/components/AppearanceSettingsPanel";
import { AccountsSettingsPanel } from "@bundle:com.livo.harmony/entry/ets/common/components/AccountsSettingsPanel";
import { AboutSettingsPanel, DataControlSettingsPanel, GeneralSettingsPanel, PrivacySettingsPanel, FavoritesPanel, } from "@bundle:com.livo.harmony/entry/ets/common/components/SettingsSecondaryPanels";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { SettingListRow } from "@bundle:com.livo.harmony/entry/ets/common/components/SettingListRow";
import { DEFAULT_HARMONY_SETTINGS } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { HarmonySettings } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
type SettingsSheetKey = '' | 'appearance' | 'general' | 'data-control' | 'privacy' | 'about' | 'favorites' | 'accounts';
const SETTINGS_ACTIVE_SHEET_KEY: string = 'settingsActiveSheetKey';
interface SettingItem {
    title: string;
    symbol: Resource;
    symbolColor: string;
    subtitle: string;
    hint?: string;
}
const PRIMARY_GROUP: SettingItem[] = [
    {
        title: '通用',
        symbol: { "id": 125831493, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#4F5D75',
        subtitle: '语言、刷新与基础偏好'
    },
    {
        title: '外观',
        symbol: { "id": 125831538, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#6C63FF',
        subtitle: '主题、字号与阅读观感'
    },
    {
        title: '数据控制',
        symbol: { "id": 125831583, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#3D7BFF',
        subtitle: '本地数据、缓存与同步控制'
    },
    {
        title: '账户',
        symbol: { "id": 125831624, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#FF8C42',
        subtitle: '账户连接与个人资料'
    },
];
const SECOND_GROUP: SettingItem[] = [
    {
        title: '收藏',
        symbol: { "id": 125831521, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#F59E0B',
        subtitle: '查看并管理已收藏的推文与内容'
    },
    {
        title: '自动化',
        symbol: { "id": 125832654, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#7A5AF8',
        subtitle: '自动刷新与智能摘要'
    },
    {
        title: '列表',
        symbol: { "id": 125831927, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#3B82F6',
        subtitle: '列表密度与内容呈现'
    },
];
const THIRD_GROUP: SettingItem[] = [
    {
        title: '订阅',
        symbol: { "id": 125831898, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#FF8A3D',
        subtitle: '订阅源导入、整理与同步'
    },
];
const FOURTH_GROUP: SettingItem[] = [
    {
        title: '隐私',
        symbol: { "id": 125832264, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#5B6CFF',
        subtitle: '代理、权限与本地隐私'
    },
    {
        title: '关于',
        symbol: { "id": 125832646, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
        symbolColor: '#7B8794',
        subtitle: '版本信息与项目说明'
    },
];
export class SettingsContent extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__config = new ObservedPropertyObjectPU(DEFAULT_HARMONY_SETTINGS, this, "config");
        this.__saveHint = new ObservedPropertySimplePU('设置将写入本地 Preferences', this, "saveHint");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__hasLoaded = new ObservedPropertySimplePU(false, this, "hasLoaded");
        this.__isLoading = new ObservedPropertySimplePU(false, this, "isLoading");
        this.__activeSheet = new ObservedPropertySimplePU('', this, "activeSheet");
        this.__showSettingsSheet = new ObservedPropertySimplePU(false, this, "showSettingsSheet");
        this.__storedActiveSheet = this.createStorageProp(SETTINGS_ACTIVE_SHEET_KEY, '', "storedActiveSheet");
        this.__settingsOverlayLevel = this.createStorageProp('settingsOverlayLevel', 0, "settingsOverlayLevel");
        this.__showBottomTabs = new SynchedPropertySimpleOneWayPU(params.showBottomTabs, this, "showBottomTabs");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.onThemeChange = () => { };
        this.onReady = () => { };
        this.setInitiallyProvidedValue(params);
        this.declareWatch("storedActiveSheet", this.handleStoredActiveSheetChange);
        this.declareWatch("inheritedTheme", this.syncInheritedTheme);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: SettingsContent_Params) {
        if (params.config !== undefined) {
            this.config = params.config;
        }
        if (params.saveHint !== undefined) {
            this.saveHint = params.saveHint;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.hasLoaded !== undefined) {
            this.hasLoaded = params.hasLoaded;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
        if (params.activeSheet !== undefined) {
            this.activeSheet = params.activeSheet;
        }
        if (params.showSettingsSheet !== undefined) {
            this.showSettingsSheet = params.showSettingsSheet;
        }
        if (params.showBottomTabs === undefined) {
            this.__showBottomTabs.set(true);
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
        if (params.onThemeChange !== undefined) {
            this.onThemeChange = params.onThemeChange;
        }
        if (params.onReady !== undefined) {
            this.onReady = params.onReady;
        }
    }
    updateStateVars(params: SettingsContent_Params) {
        this.__showBottomTabs.reset(params.showBottomTabs);
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__config.purgeDependencyOnElmtId(rmElmtId);
        this.__saveHint.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__hasLoaded.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
        this.__activeSheet.purgeDependencyOnElmtId(rmElmtId);
        this.__showSettingsSheet.purgeDependencyOnElmtId(rmElmtId);
        this.__storedActiveSheet.purgeDependencyOnElmtId(rmElmtId);
        this.__settingsOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__showBottomTabs.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__config.aboutToBeDeleted();
        this.__saveHint.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__hasLoaded.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
        this.__activeSheet.aboutToBeDeleted();
        this.__showSettingsSheet.aboutToBeDeleted();
        this.__storedActiveSheet.aboutToBeDeleted();
        this.__settingsOverlayLevel.aboutToBeDeleted();
        this.__showBottomTabs.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private static readonly SHEET_MIN_HEIGHT: number = 420;
    private static readonly SHEET_COMPACT_HEIGHT: number = 440;
    private static readonly SHEET_STANDARD_HEIGHT: number = 500;
    private static readonly SHEET_TALL_HEIGHT: number = 600;
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
    private __hasLoaded: ObservedPropertySimplePU<boolean>;
    get hasLoaded() {
        return this.__hasLoaded.get();
    }
    set hasLoaded(newValue: boolean) {
        this.__hasLoaded.set(newValue);
    }
    private __isLoading: ObservedPropertySimplePU<boolean>;
    get isLoading() {
        return this.__isLoading.get();
    }
    set isLoading(newValue: boolean) {
        this.__isLoading.set(newValue);
    }
    private __activeSheet: ObservedPropertySimplePU<SettingsSheetKey>;
    get activeSheet() {
        return this.__activeSheet.get();
    }
    set activeSheet(newValue: SettingsSheetKey) {
        this.__activeSheet.set(newValue);
    }
    private __showSettingsSheet: ObservedPropertySimplePU<boolean>;
    get showSettingsSheet() {
        return this.__showSettingsSheet.get();
    }
    set showSettingsSheet(newValue: boolean) {
        this.__showSettingsSheet.set(newValue);
    }
    private __storedActiveSheet: ObservedPropertyAbstractPU<SettingsSheetKey>;
    get storedActiveSheet() {
        return this.__storedActiveSheet.get();
    }
    set storedActiveSheet(newValue: SettingsSheetKey) {
        this.__storedActiveSheet.set(newValue);
    }
    private __settingsOverlayLevel: ObservedPropertyAbstractPU<number>;
    get settingsOverlayLevel() {
        return this.__settingsOverlayLevel.get();
    }
    set settingsOverlayLevel(newValue: number) {
        this.__settingsOverlayLevel.set(newValue);
    }
    private __showBottomTabs: SynchedPropertySimpleOneWayPU<boolean>;
    get showBottomTabs() {
        return this.__showBottomTabs.get();
    }
    set showBottomTabs(newValue: boolean) {
        this.__showBottomTabs.set(newValue);
    }
    private __inheritedTheme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get inheritedTheme() {
        return this.__inheritedTheme.get();
    }
    set inheritedTheme(newValue: ThemePalette) {
        this.__inheritedTheme.set(newValue);
    }
    private onThemeChange: (theme: ThemePalette) => void;
    private onReady: () => void;
    aboutToAppear(): void {
        const restoreSheet = this.storedActiveSheet || AppStorage.get<SettingsSheetKey>(SETTINGS_ACTIVE_SHEET_KEY);
        if (restoreSheet && !this.showSettingsSheet) {
            this.activeSheet = restoreSheet;
            this.showSettingsSheet = true;
            AppStorage.setOrCreate('settingsOverlayLevel', 1);
        }
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
            if (this.hasLoaded || this.isLoading) {
                this.onReady();
                return;
            }
        }
        void this.loadSettings();
    }
    private handleStoredActiveSheetChange(): void {
        if (this.storedActiveSheet && !this.showSettingsSheet) {
            this.activeSheet = this.storedActiveSheet;
            this.showSettingsSheet = true;
            AppStorage.setOrCreate('settingsOverlayLevel', 1);
            return;
        }
        if (!this.storedActiveSheet && this.showSettingsSheet && this.activeSheet === '') {
            this.showSettingsSheet = false;
            AppStorage.setOrCreate('settingsOverlayLevel', 0);
        }
    }
    private async loadSettings(): Promise<void> {
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        try {
            this.config = await AppRepository.settings();
            if (this.showBottomTabs) {
                this.theme = await ThemeService.resolvePalette(this.config);
            }
            else {
                this.theme = this.inheritedTheme;
            }
            this.saveHint = '已加载本地配置';
            this.hasLoaded = true;
            this.onReady();
        }
        finally {
            this.isLoading = false;
        }
    }
    private syncInheritedTheme(): void {
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
        }
    }
    private syncSettings(next: HarmonySettings): void {
        this.config = next;
        void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
            this.config = saved;
            void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
                this.theme = palette;
                this.onThemeChange(palette);
            });
            this.saveHint = '已保存到本地 Preferences';
        }).catch((error: Error) => {
            this.saveHint = `保存失败：${error.message}`;
        });
    }
    private handleAppearanceSettingsChange(settings: HarmonySettings): void {
        this.config = settings;
    }
    private openSheet(sheet: SettingsSheetKey): void {
        if (this.showSettingsSheet && this.activeSheet === sheet) {
            return;
        }
        this.activeSheet = sheet;
        this.showSettingsSheet = true;
        AppStorage.setOrCreate('settingsOverlayLevel', 1);
        AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, sheet);
    }
    private closeSheet(): void {
        this.showSettingsSheet = false;
        AppStorage.setOrCreate('settingsOverlayLevel', 0);
        AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, '');
    }
    private initialSheetHeight(): number {
        let preferredHeight = SettingsContent.SHEET_STANDARD_HEIGHT;
        switch (this.activeSheet) {
            case 'data-control':
                preferredHeight = SettingsContent.SHEET_COMPACT_HEIGHT;
                break;
            case 'general':
                preferredHeight = 450;
                break;
            case 'about':
                preferredHeight = 460;
                break;
            case 'privacy':
                preferredHeight = 520;
                break;
            case 'accounts':
                preferredHeight = 520;
                break;
            case 'appearance':
            case 'favorites':
                preferredHeight = SettingsContent.SHEET_TALL_HEIGHT;
                break;
            default:
                preferredHeight = SettingsContent.SHEET_STANDARD_HEIGHT;
                break;
        }
        return Math.max(SettingsContent.SHEET_MIN_HEIGHT, preferredHeight);
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
    private SettingRow(item: SettingItem, delay: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.transition(livoMotion.enterScale(delay));
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new SettingListRow(this, {
                        title: item.title,
                        symbol: item.symbol,
                        symbolColor: item.symbolColor,
                        subtitle: this.resolveSubtitle(item),
                        hint: this.resolveHint(item),
                        theme: this.theme,
                        onTap: () => this.handleSettingTap(item),
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 259, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: item.title,
                            symbol: item.symbol,
                            symbolColor: item.symbolColor,
                            subtitle: this.resolveSubtitle(item),
                            hint: this.resolveHint(item),
                            theme: this.theme,
                            onTap: () => this.handleSettingTap(item)
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: item.title,
                        symbol: item.symbol,
                        symbolColor: item.symbolColor,
                        subtitle: this.resolveSubtitle(item),
                        hint: this.resolveHint(item),
                        theme: this.theme
                    });
                }
            }, { name: "SettingListRow" });
        }
        __Common__.pop();
    }
    private Group(items: SettingItem[], delay: number, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = (_item, index: number) => {
                const item = _item;
                this.SettingRow.bind(this)(item, delay + index * 12);
            };
            this.forEachUpdateFunction(elmtId, items, forEachItemGenFunction, (item: SettingItem) => item.title, true, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    private resolveSubtitle(item: SettingItem): string {
        if (item.title === '外观') {
            return `${item.subtitle} · 当前${this.themeLabel()}`;
        }
        if (item.title === '通用') {
            return `${item.subtitle} · ${this.config.language}`;
        }
        if (item.title === '自动化') {
            return `${item.subtitle} · ${this.config.autoRefresh ? '已开启' : '已关闭'}`;
        }
        return item.subtitle;
    }
    private resolveHint(item: SettingItem): string {
        return item.hint ?? '';
    }
    private handleSettingTap(item: SettingItem): void {
        if (item.title === '收藏') {
            this.openSheet('favorites');
            return;
        }
        if (item.title === '账户') {
            this.openSheet('accounts');
            return;
        }
        if (item.title === '外观') {
            this.openSheet('appearance');
            return;
        }
        if (item.title === '通用') {
            this.openSheet('general');
            return;
        }
        if (item.title === '数据控制') {
            this.openSheet('data-control');
            return;
        }
        if (item.title === '隐私') {
            this.openSheet('privacy');
            return;
        }
        if (item.title === '关于') {
            this.openSheet('about');
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
            Stack.bindSheet({ value: this.showSettingsSheet, changeEvent: newValue => { this.showSettingsSheet = newValue; } }, { builder: () => {
                    this.SettingsSheetOverlay.call(this);
                } }, {
                detents: [this.initialSheetHeight(), SheetSize.LARGE],
                dragBar: false,
                showClose: false,
                backgroundColor: this.theme.background,
                keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
                scrollSizeMode: ScrollSizeMode.CONTINUOUS,
                preferType: SheetType.CENTER,
                onWillDismiss: () => {
                    this.showSettingsSheet = false;
                    this.activeSheet = '';
                    AppStorage.setOrCreate('settingsOverlayLevel', 0);
                    AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, '');
                }
            });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            List.create({ space: 18 });
            List.width('100%');
            List.height('100%');
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
            };
            const deepRenderFunction = (elmtId, isInitialRender) => {
                itemCreation(elmtId, isInitialRender);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create();
                    Column.width('100%');
                    Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING });
                }, Column);
                {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        if (isInitialRender) {
                            let componentCall = new PageHeader(this, {
                                title: '设置',
                                theme: this.theme,
                            }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 333, col: 13 });
                            ViewPU.create(componentCall);
                            let paramsLambda = () => {
                                return {
                                    title: '设置',
                                    theme: this.theme
                                };
                            };
                            componentCall.paramsGenerator_ = paramsLambda;
                        }
                        else {
                            this.updateStateVarsOfChildByElmtId(elmtId, {
                                title: '设置',
                                theme: this.theme
                            });
                        }
                    }, { name: "PageHeader" });
                }
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
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create({ space: 14 });
                    Column.width('100%');
                    Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, bottom: 8 });
                }, Column);
                this.Group.bind(this)(PRIMARY_GROUP, 30);
                this.Group.bind(this)(SECOND_GROUP, 50);
                this.Group.bind(this)(THIRD_GROUP, 70);
                this.Group.bind(this)(FOURTH_GROUP, 90);
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
            If.create();
            if (this.showBottomTabs && !this.showSettingsSheet) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        __Common__.create();
                        __Common__.align(Alignment.Bottom);
                    }, __Common__);
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new BottomTabs(this, { activeTab: 'settings', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 364, col: 9 });
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
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private SettingsSheetOverlay(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.ActiveSheet.bind(this)();
        Column.pop();
    }
    private ActiveSheet(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.justifyContent(FlexAlign.Start);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.activeSheet === 'appearance') {
                this.ifElseBranchUpdateFunction(0, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new AppearanceSettingsPanel(this, {
                                    showBackButton: false,
                                    initialSettings: this.config,
                                    inheritedTheme: this.theme,
                                    onSettingsChange: (settings: HarmonySettings) => {
                                        this.handleAppearanceSettingsChange(settings);
                                    },
                                    onThemeChange: (theme: ThemePalette) => {
                                        this.theme = theme;
                                        this.onThemeChange(theme);
                                    },
                                    onClose: () => {
                                        this.closeSheet();
                                    },
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 402, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        showBackButton: false,
                                        initialSettings: this.config,
                                        inheritedTheme: this.theme,
                                        onSettingsChange: (settings: HarmonySettings) => {
                                            this.handleAppearanceSettingsChange(settings);
                                        },
                                        onThemeChange: (theme: ThemePalette) => {
                                            this.theme = theme;
                                            this.onThemeChange(theme);
                                        },
                                        onClose: () => {
                                            this.closeSheet();
                                        }
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    showBackButton: false,
                                    initialSettings: this.config,
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "AppearanceSettingsPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'general') {
                this.ifElseBranchUpdateFunction(1, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new GeneralSettingsPanel(this, {
                                    onSettingsChange: (settings: HarmonySettings) => {
                                        this.config = settings;
                                    },
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 418, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        onSettingsChange: (settings: HarmonySettings) => {
                                            this.config = settings;
                                        }
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {});
                            }
                        }, { name: "GeneralSettingsPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'data-control') {
                this.ifElseBranchUpdateFunction(2, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new DataControlSettingsPanel(this, {
                                    onSettingsChange: (settings: HarmonySettings) => {
                                        this.config = settings;
                                    },
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 424, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        onSettingsChange: (settings: HarmonySettings) => {
                                            this.config = settings;
                                        }
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {});
                            }
                        }, { name: "DataControlSettingsPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'privacy') {
                this.ifElseBranchUpdateFunction(3, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new PrivacySettingsPanel(this, {}, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 430, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {};
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {});
                            }
                        }, { name: "PrivacySettingsPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'about') {
                this.ifElseBranchUpdateFunction(4, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new AboutSettingsPanel(this, {}, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 432, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {};
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {});
                            }
                        }, { name: "AboutSettingsPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'favorites') {
                this.ifElseBranchUpdateFunction(5, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new FavoritesPanel(this, {}, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 434, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {};
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {});
                            }
                        }, { name: "FavoritesPanel" });
                    }
                });
            }
            else if (this.activeSheet === 'accounts') {
                this.ifElseBranchUpdateFunction(6, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new AccountsSettingsPanel(this, {
                                    inheritedTheme: this.theme,
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SettingsContent.ets", line: 436, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        inheritedTheme: this.theme
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "AccountsSettingsPanel" });
                    }
                });
            }
            else {
                this.ifElseBranchUpdateFunction(7, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

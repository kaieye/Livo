if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AppearanceSettingsPanel_Params {
    config?: HarmonySettings;
    theme?: ThemePalette;
    themeModeText?: string;
    themeAccentText?: string;
    refreshIntervalText?: string;
    languageText?: string;
    showBackButton?: boolean;
    initialSettings?: HarmonySettings;
    inheritedTheme?: ThemePalette;
    onThemeChange?: (theme: ThemePalette) => void;
    onSettingsChange?: (settings: HarmonySettings) => void;
    onClose?: () => void;
}
import { SymbolGlyphModifier } from "@ohos:arkui.modifier";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { DEFAULT_HARMONY_SETTINGS } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { HarmonySettings, ThemeAccent, ThemeMode } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
interface AppearanceOption {
    label: string;
    value: string;
    color?: string;
}
const THEME_MODE_OPTIONS: AppearanceOption[] = [
    { label: '跟随系统', value: 'system' },
    { label: '浅色', value: 'light' },
    { label: '深色', value: 'dark' },
];
const THEME_ACCENT_OPTIONS: AppearanceOption[] = [
    { label: '流光橙', value: 'orange', color: '#FF6A00' },
    { label: '星河蓝', value: 'blue', color: '#2563EB' },
    { label: '珊瑚红', value: 'red', color: '#DC2626' },
    { label: '莓果粉', value: 'pink', color: '#DB2777' },
    { label: '森林绿', value: 'green', color: '#16A34A' },
];
const REFRESH_INTERVAL_OPTIONS: AppearanceOption[] = [
    { label: '15 分钟', value: '15' },
    { label: '30 分钟', value: '30' },
    { label: '60 分钟', value: '60' },
    { label: '120 分钟', value: '120' },
];
const LANGUAGE_OPTIONS: AppearanceOption[] = [
    { label: '简体中文', value: 'zh-CN' },
    { label: 'English', value: 'en' },
];
const ROW_MIN_HEIGHT: number = 56;
const ROW_ICON_SIZE: number = 22;
const ROW_TITLE_SIZE: number = 15;
const ROW_SUBTITLE_SIZE: number = 12;
const ROW_TIPS_SIZE: number = 12;
const PANEL_HANDLE_TOP_PADDING: number = 10;
const PANEL_HANDLE_BOTTOM_PADDING: number = 8;
const PANEL_SECTION_SPACING: number = 2;
const ROW_TEXT_SPACING: number = 2;
export class AppearanceSettingsPanel extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__config = new ObservedPropertyObjectPU(DEFAULT_HARMONY_SETTINGS, this, "config");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__themeModeText = new ObservedPropertySimplePU('跟随系统', this, "themeModeText");
        this.__themeAccentText = new ObservedPropertySimplePU('流光橙', this, "themeAccentText");
        this.__refreshIntervalText = new ObservedPropertySimplePU('30 分钟', this, "refreshIntervalText");
        this.__languageText = new ObservedPropertySimplePU('简体中文', this, "languageText");
        this.__showBackButton = new SynchedPropertySimpleOneWayPU(params.showBackButton, this, "showBackButton");
        this.__initialSettings = new SynchedPropertyObjectOneWayPU(params.initialSettings, this, "initialSettings");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.onThemeChange = () => { };
        this.onSettingsChange = () => { };
        this.onClose = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AppearanceSettingsPanel_Params) {
        if (params.config !== undefined) {
            this.config = params.config;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.themeModeText !== undefined) {
            this.themeModeText = params.themeModeText;
        }
        if (params.themeAccentText !== undefined) {
            this.themeAccentText = params.themeAccentText;
        }
        if (params.refreshIntervalText !== undefined) {
            this.refreshIntervalText = params.refreshIntervalText;
        }
        if (params.languageText !== undefined) {
            this.languageText = params.languageText;
        }
        if (params.showBackButton === undefined) {
            this.__showBackButton.set(true);
        }
        if (params.initialSettings === undefined) {
            this.__initialSettings.set(DEFAULT_HARMONY_SETTINGS);
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
        if (params.onThemeChange !== undefined) {
            this.onThemeChange = params.onThemeChange;
        }
        if (params.onSettingsChange !== undefined) {
            this.onSettingsChange = params.onSettingsChange;
        }
        if (params.onClose !== undefined) {
            this.onClose = params.onClose;
        }
    }
    updateStateVars(params: AppearanceSettingsPanel_Params) {
        this.__showBackButton.reset(params.showBackButton);
        this.__initialSettings.reset(params.initialSettings);
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__config.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__themeModeText.purgeDependencyOnElmtId(rmElmtId);
        this.__themeAccentText.purgeDependencyOnElmtId(rmElmtId);
        this.__refreshIntervalText.purgeDependencyOnElmtId(rmElmtId);
        this.__languageText.purgeDependencyOnElmtId(rmElmtId);
        this.__showBackButton.purgeDependencyOnElmtId(rmElmtId);
        this.__initialSettings.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__config.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__themeModeText.aboutToBeDeleted();
        this.__themeAccentText.aboutToBeDeleted();
        this.__refreshIntervalText.aboutToBeDeleted();
        this.__languageText.aboutToBeDeleted();
        this.__showBackButton.aboutToBeDeleted();
        this.__initialSettings.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
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
    private __themeModeText: ObservedPropertySimplePU<string>;
    get themeModeText() {
        return this.__themeModeText.get();
    }
    set themeModeText(newValue: string) {
        this.__themeModeText.set(newValue);
    }
    private __themeAccentText: ObservedPropertySimplePU<string>;
    get themeAccentText() {
        return this.__themeAccentText.get();
    }
    set themeAccentText(newValue: string) {
        this.__themeAccentText.set(newValue);
    }
    private __refreshIntervalText: ObservedPropertySimplePU<string>;
    get refreshIntervalText() {
        return this.__refreshIntervalText.get();
    }
    set refreshIntervalText(newValue: string) {
        this.__refreshIntervalText.set(newValue);
    }
    private __languageText: ObservedPropertySimplePU<string>;
    get languageText() {
        return this.__languageText.get();
    }
    set languageText(newValue: string) {
        this.__languageText.set(newValue);
    }
    private __showBackButton: SynchedPropertySimpleOneWayPU<boolean>;
    get showBackButton() {
        return this.__showBackButton.get();
    }
    set showBackButton(newValue: boolean) {
        this.__showBackButton.set(newValue);
    }
    private __initialSettings: SynchedPropertySimpleOneWayPU<HarmonySettings>;
    get initialSettings() {
        return this.__initialSettings.get();
    }
    set initialSettings(newValue: HarmonySettings) {
        this.__initialSettings.set(newValue);
    }
    private __inheritedTheme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get inheritedTheme() {
        return this.__inheritedTheme.get();
    }
    set inheritedTheme(newValue: ThemePalette) {
        this.__inheritedTheme.set(newValue);
    }
    private onThemeChange: (theme: ThemePalette) => void;
    private onSettingsChange: (settings: HarmonySettings) => void;
    private onClose: () => void;
    aboutToAppear(): void {
        this.applyResolvedState(this.initialSettings, this.inheritedTheme);
        void this.loadSettings();
    }
    private async loadSettings(): Promise<void> {
        const saved = await AppRepository.settings();
        const palette = await ThemeService.resolvePalette(saved);
        this.applyResolvedState(saved, palette);
    }
    private applyResolvedState(settings: HarmonySettings, palette: ThemePalette): void {
        this.config = settings;
        this.theme = palette;
        this.themeModeText = this.resolveThemeLabel(settings.themeMode);
        this.themeAccentText = this.resolveAccentLabel(settings.themeAccent);
        this.refreshIntervalText = `${settings.refreshIntervalMinutes} 分钟`;
        this.languageText = settings.language === 'en' ? 'English' : '简体中文';
        this.onSettingsChange(settings);
        this.onThemeChange(palette);
    }
    private syncSettings(next: HarmonySettings): void {
        const optimisticTheme: ThemePalette = {
            isDark: this.theme.isDark,
            background: this.theme.background,
            surface: this.theme.surface,
            elevated: this.theme.elevated,
            textPrimary: this.theme.textPrimary,
            textSecondary: this.theme.textSecondary,
            textMuted: this.theme.textMuted,
            divider: this.theme.divider,
            accent: this.resolveAccentColor(next.themeAccent),
            accentText: '#FFFFFF',
            tabBarBackground: this.theme.tabBarBackground,
            tabBarInactive: this.theme.tabBarInactive,
            dragHandle: this.theme.dragHandle,
        };
        this.applyResolvedState(next, optimisticTheme);
        void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
            void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
                this.applyResolvedState(saved, palette);
            });
        }).catch((_error: Error) => { });
    }
    private resolveThemeLabel(themeMode: ThemeMode): string {
        switch (themeMode) {
            case 'light':
                return '浅色';
            case 'dark':
                return '深色';
            default:
                return '跟随系统';
        }
    }
    private resolveAccentLabel(themeAccent: ThemeAccent): string {
        switch (themeAccent) {
            case 'blue':
                return '星河蓝';
            case 'red':
                return '珊瑚红';
            case 'pink':
                return '莓果粉';
            case 'green':
                return '森林绿';
            default:
                return '流光橙';
        }
    }
    private resolveAccentColor(themeAccent: ThemeAccent): string {
        switch (themeAccent) {
            case 'blue':
                return '#2563EB';
            case 'red':
                return '#DC2626';
            case 'pink':
                return '#DB2777';
            case 'green':
                return '#16A34A';
            default:
                return '#FF6A00';
        }
    }
    private applyThemeMode(value: string): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: value as ThemeMode,
            themeAccent: this.config.themeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private applyThemeAccent(value: string): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: value as ThemeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private applyRefreshInterval(value: string): void {
        const minutes = Number(value);
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: Number.isFinite(minutes) ? minutes : this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: this.config.themeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private applyLanguage(value: string): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: this.config.themeAccent,
            language: value,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private toggleAutoRefresh(): void {
        this.syncSettings({
            autoRefresh: !this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: this.config.themeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private toggleAiSummary(): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: !this.config.aiSummaryEnabled,
            imageProxyEnabled: this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: this.config.themeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
    }
    private toggleImageProxy(): void {
        this.syncSettings({
            autoRefresh: this.config.autoRefresh,
            aiSummaryEnabled: this.config.aiSummaryEnabled,
            imageProxyEnabled: !this.config.imageProxyEnabled,
            refreshIntervalMinutes: this.config.refreshIntervalMinutes,
            themeMode: this.config.themeMode,
            themeAccent: this.config.themeAccent,
            language: this.config.language,
            remoteFeedUrl: this.config.remoteFeedUrl,
        });
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
    private OptionMenu(options: AppearanceOption[], selectedValue: string, onSelect: (value: string) => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Menu.create();
        }, Menu);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const option = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    MenuItem.create({
                        content: option.label,
                        symbolStartIcon: option.color
                            ? new SymbolGlyphModifier({ "id": 125831711, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }).fontColor([option.color])
                            : undefined,
                        symbolEndIcon: selectedValue === option.value ? new SymbolGlyphModifier({ "id": 125831490, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }) : undefined
                    });
                    MenuItem.selected(selectedValue === option.value);
                    MenuItem.onChange((selected: boolean) => {
                        if (selected) {
                            onSelect(option.value);
                        }
                    });
                }, MenuItem);
                MenuItem.pop();
            };
            this.forEachUpdateFunction(elmtId, options, forEachItemGenFunction, (option: AppearanceOption) => option.value, false, false);
        }, ForEach);
        ForEach.pop();
        Menu.pop();
    }
    private MenuAction(label: string, options: AppearanceOption[], selectedValue: string, onSelect: (value: string) => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.padding({ left: 6, right: 6, top: 8, bottom: 8 });
            Row.bindMenu({ builder: () => {
                    this.OptionMenu.call(this, options, selectedValue, onSelect);
                } });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(ROW_TIPS_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125832670, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(12);
            SymbolGlyph.fontColor([this.theme.textMuted]);
            SymbolGlyph.margin({ left: 7, right: 2, top: 1 });
        }, SymbolGlyph);
        Row.pop();
    }
    private ThemeModeRow(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: ROW_MIN_HEIGHT });
            Row.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831684, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(ROW_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(0));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('主题模式');
            Text.fontSize(ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('切换浅色、深色或跟随系统');
            Text.fontSize(ROW_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.padding({ left: 6, right: 6, top: 8, bottom: 8 });
            Row.bindMenu({ builder: () => {
                    this.OptionMenu.call(this, THEME_MODE_OPTIONS, this.config.themeMode, (value: string) => {
                        this.applyThemeMode(value);
                    });
                } });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.resolveThemeLabel(this.config.themeMode));
            Text.fontSize(ROW_TIPS_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125832670, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(12);
            SymbolGlyph.fontColor([this.theme.textMuted]);
            SymbolGlyph.margin({ left: 7, right: 2, top: 1 });
        }, SymbolGlyph);
        Row.pop();
        Row.pop();
    }
    private RefreshIntervalRow(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: ROW_MIN_HEIGHT });
            Row.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831551, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(ROW_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(1));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('刷新间隔');
            Text.fontSize(ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('控制后台自动刷新的频率');
            Text.fontSize(ROW_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.MenuAction.bind(this)(this.refreshIntervalText, REFRESH_INTERVAL_OPTIONS, `${this.config.refreshIntervalMinutes}`, (value: string) => this.applyRefreshInterval(value));
        Row.pop();
    }
    private LanguageRow(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: ROW_MIN_HEIGHT });
            Row.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831726, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(ROW_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(2));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('界面语言');
            Text.fontSize(ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('切换应用显示语言');
            Text.fontSize(ROW_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.MenuAction.bind(this)(this.languageText, LANGUAGE_OPTIONS, this.config.language, (value: string) => this.applyLanguage(value));
        Row.pop();
    }
    private ToggleRow(icon: Resource, title: string, subtitle: string, checked: boolean, onToggle: () => void, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: ROW_MIN_HEIGHT });
            Row.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.onClick(() => onToggle());
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(icon);
            SymbolGlyph.fontSize(ROW_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(3));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(title);
            Text.fontSize(ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(subtitle);
            Text.fontSize(ROW_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
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
    private SheetHandle(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!this.showBackButton) {
                this.ifElseBranchUpdateFunction(0, () => {
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
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private ThemeAccentRow(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.constraintSize({ minHeight: ROW_MIN_HEIGHT });
            Row.padding({ left: 12, right: 12, top: 6, bottom: 6 });
            Row.backgroundColor(this.theme.surface);
            Row.borderRadius(20);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125831711, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(ROW_ICON_SIZE);
            SymbolGlyph.fontColor([this.theme.accent]);
            SymbolGlyph.transition(livoMotion.enterIconSpin(0.5));
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: ROW_TEXT_SPACING });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('主题色');
            Text.fontSize(ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('统一强调色、选中态与操作按钮色彩');
            Text.fontSize(ROW_SUBTITLE_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.MenuAction.bind(this)(this.themeAccentText, THEME_ACCENT_OPTIONS, this.config.themeAccent, (value: string) => this.applyThemeAccent(value));
        Row.pop();
    }
    private PanelHeader(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.width('100%');
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '外观',
                        theme: this.theme,
                        showBackButton: this.showBackButton,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/AppearanceSettingsPanel.ets", line: 506, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '外观',
                            theme: this.theme,
                            showBackButton: this.showBackButton,
                            titleSize: 20,
                            topPadding: 0,
                            bottomPadding: 0
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '外观',
                        theme: this.theme,
                        showBackButton: this.showBackButton,
                        titleSize: 20,
                        topPadding: 0,
                        bottomPadding: 0
                    });
                }
            }, { name: "PageHeader" });
        }
        __Common__.pop();
    }
    private SettingsGroup(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(40));
        }, Column);
        this.ThemeModeRow.bind(this)();
        this.DividerLine.bind(this)();
        this.ThemeAccentRow.bind(this)();
        this.DividerLine.bind(this)();
        this.RefreshIntervalRow.bind(this)();
        this.DividerLine.bind(this)();
        this.LanguageRow.bind(this)();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(CARD_RADIUS_LG);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.transition(livoMotion.enterSoft(70));
        }, Column);
        this.ToggleRow.bind(this)({ "id": 125831551, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '自动刷新', '进入应用后保持订阅内容及时更新', this.config.autoRefresh, () => this.toggleAutoRefresh());
        this.DividerLine.bind(this)();
        this.ToggleRow.bind(this)({ "id": 125831772, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, 'AI 摘要', '在文章详情中启用智能摘要能力', this.config.aiSummaryEnabled, () => this.toggleAiSummary());
        this.DividerLine.bind(this)();
        this.ToggleRow.bind(this)({ "id": 125831583, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" }, '图片代理', '使用代理加载远程图片内容', this.config.imageProxyEnabled, () => this.toggleImageProxy());
        Column.pop();
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
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({
                left: PAGE_HORIZONTAL_PADDING,
                right: PAGE_HORIZONTAL_PADDING,
                top: 0,
                bottom: 12,
            });
        }, Column);
        this.SheetHandle.bind(this)();
        this.PanelHeader.bind(this)();
        this.SettingsGroup.bind(this)();
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

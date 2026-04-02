if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface BottomTabs_Params {
    activeTab?: RootTabId;
    theme?: ThemePalette;
    useTabsController?: boolean;
    bottomAvoidArea?: number;
    pressedTabId?: RootTabId | '';
    onTabRequest?: (tabId: RootTabId) => void;
}
import { ROOT_TABS, openRootTab } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import type { RootTabId, RootTabDefinition } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { BOTTOM_TAB_BAR_HEIGHT, BOTTOM_TAB_FLOAT_GAP, BOTTOM_TAB_BAR_WIDTH, BOTTOM_TAB_ITEM_HEIGHT, BOTTOM_TAB_LABEL_SIZE, BOTTOM_TAB_TOTAL_HEIGHT, CHIP_RADIUS, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
export class BottomTabs extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__activeTab = new SynchedPropertySimpleOneWayPU(params.activeTab, this, "activeTab");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.__useTabsController = new SynchedPropertySimpleOneWayPU(params.useTabsController, this, "useTabsController");
        this.__bottomAvoidArea = this.createStorageProp('bottomAvoidArea', 0, "bottomAvoidArea");
        this.__pressedTabId = new ObservedPropertySimplePU('', this, "pressedTabId");
        this.onTabRequest = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: BottomTabs_Params) {
        if (params.activeTab === undefined) {
            this.__activeTab.set('home');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.useTabsController === undefined) {
            this.__useTabsController.set(false);
        }
        if (params.pressedTabId !== undefined) {
            this.pressedTabId = params.pressedTabId;
        }
        if (params.onTabRequest !== undefined) {
            this.onTabRequest = params.onTabRequest;
        }
    }
    updateStateVars(params: BottomTabs_Params) {
        this.__activeTab.reset(params.activeTab);
        this.__theme.reset(params.theme);
        this.__useTabsController.reset(params.useTabsController);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__activeTab.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__useTabsController.purgeDependencyOnElmtId(rmElmtId);
        this.__bottomAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__pressedTabId.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__activeTab.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__useTabsController.aboutToBeDeleted();
        this.__bottomAvoidArea.aboutToBeDeleted();
        this.__pressedTabId.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __activeTab: SynchedPropertySimpleOneWayPU<RootTabId>;
    get activeTab() {
        return this.__activeTab.get();
    }
    set activeTab(newValue: RootTabId) {
        this.__activeTab.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __useTabsController: SynchedPropertySimpleOneWayPU<boolean>;
    get useTabsController() {
        return this.__useTabsController.get();
    }
    set useTabsController(newValue: boolean) {
        this.__useTabsController.set(newValue);
    }
    private __bottomAvoidArea: ObservedPropertyAbstractPU<number>;
    get bottomAvoidArea() {
        return this.__bottomAvoidArea.get();
    }
    set bottomAvoidArea(newValue: number) {
        this.__bottomAvoidArea.set(newValue);
    }
    private __pressedTabId: ObservedPropertySimplePU<RootTabId | ''>;
    get pressedTabId() {
        return this.__pressedTabId.get();
    }
    set pressedTabId(newValue: RootTabId | '') {
        this.__pressedTabId.set(newValue);
    }
    private onTabRequest: (tabId: RootTabId) => void;
    private isActive(tabId: RootTabId): boolean {
        return this.activeTab === tabId;
    }
    private itemWidth(): string {
        return `${100 / ROOT_TABS.length}%`;
    }
    private containerHeight(): number {
        return BOTTOM_TAB_TOTAL_HEIGHT + this.bottomAvoidArea;
    }
    private labelColor(tabId: RootTabId): string {
        return this.isActive(tabId) ? this.activeColor() : this.inactiveColor();
    }
    private iconColor(tabId: RootTabId): string {
        return this.isActive(tabId) ? this.activeColor() : this.inactiveColor();
    }
    private activeColor(): string {
        return this.theme.isDark ? '#76A2FF' : '#2F6BFF';
    }
    private inactiveColor(): string {
        return this.theme.isDark ? '#A3A8B3' : '#9B9BA1';
    }
    private itemOffset(tabId: RootTabId): number {
        if (this.isActive(tabId)) {
            return -2;
        }
        return 0;
    }
    private itemOpacity(tabId: RootTabId): number {
        return this.isActive(tabId) ? 1 : 0.94;
    }
    private itemScale(tabId: RootTabId): number {
        if (this.pressedTabId === tabId) {
            return 0.985;
        }
        return 1;
    }
    private dockBorderColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.94)';
    }
    private dockShadowColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.25)';
    }
    private dockBackgroundColor(): string {
        return this.theme.isDark ? 'rgba(20,22,28,0.85)' : 'rgba(255,255,255,0.85)';
    }
    private labelWeight(tabId: RootTabId): number {
        return this.isActive(tabId) ? FontWeight.Medium : FontWeight.Regular;
    }
    private itemBackgroundColor(tabId: RootTabId): string {
        if (!this.isActive(tabId)) {
            return 'rgba(0,0,0,0)';
        }
        return this.theme.isDark ? 'rgba(118,162,255,0.10)' : 'rgba(47,107,255,0.08)';
    }
    private itemBorderColor(tabId: RootTabId): string {
        if (!this.isActive(tabId)) {
            return 'rgba(0,0,0,0)';
        }
        return this.theme.isDark ? 'rgba(118,162,255,0.18)' : 'rgba(47,107,255,0.12)';
    }
    private itemShadowColor(tabId: RootTabId): string {
        if (!this.isActive(tabId)) {
            return 'rgba(0,0,0,0)';
        }
        return 'rgba(0,0,0,0)';
    }
    private tabIcon(tabId: RootTabId): Resource {
        if (tabId === 'home') {
            return this.isActive(tabId) ? { "id": 16777231, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777232, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        }
        if (tabId === 'subscriptions') {
            return this.isActive(tabId) ? { "id": 16777235, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777236, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        }
        if (tabId === 'discover') {
            return this.isActive(tabId) ? { "id": 16777229, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777230, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
        }
        return this.isActive(tabId) ? { "id": 16777233, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" } : { "id": 16777234, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" };
    }
    private async navigate(tabId: RootTabId): Promise<void> {
        if (this.activeTab === tabId) {
            return;
        }
        if (this.useTabsController) {
            this.onTabRequest(tabId);
            return;
        }
        try {
            await openRootTab(tabId, true);
        }
        catch (_) {
            try {
                await openRootTab(tabId, false);
            }
            catch (_) {
            }
        }
    }
    private Icon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Image.create(this.tabIcon(tabId));
            Context.animation({ duration: 160, curve: Curve.EaseOut });
            Image.width(24);
            Image.height(24);
            Image.objectFit(ImageFit.Contain);
            Context.animation(null);
        }, Image);
    }
    private DockShell(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(BOTTOM_TAB_BAR_WIDTH);
            Row.height(BOTTOM_TAB_BAR_HEIGHT);
            Row.backgroundColor(this.dockBackgroundColor());
            Row.backdropBlur(this.theme.isDark ? 10 : 18);
            Row.borderRadius(CHIP_RADIUS);
            Row.border({ width: 0.6, color: this.dockBorderColor() });
            Row.shadow({
                radius: 10,
                color: this.dockShadowColor(),
                offsetX: 0,
                offsetY: 2,
            });
        }, Row);
        Row.pop();
    }
    private TabButton(tab: RootTabDefinition, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 3 });
            Context.animation({ duration: 140, curve: Curve.EaseOut });
            Column.alignItems(HorizontalAlign.Center);
            Column.justifyContent(FlexAlign.Start);
            Column.width(this.itemWidth());
            Column.height(BOTTOM_TAB_ITEM_HEIGHT);
            Column.padding({ top: 9, bottom: 2 });
            Column.scale({ x: this.itemScale(tab.id), y: this.itemScale(tab.id) });
            Column.translate({ y: this.itemOffset(tab.id) });
            Column.opacity(this.itemOpacity(tab.id));
            Context.animation(null);
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.pressedTabId = tab.id;
                    return;
                }
                if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
                    if (this.pressedTabId === tab.id) {
                        this.pressedTabId = '';
                    }
                }
            });
            Column.onClick(() => {
                void this.navigate(tab.id);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.width(36);
            Stack.height(26);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Context.animation({ duration: 140, curve: Curve.EaseOut });
            Row.width(36);
            Row.height(26);
            Row.borderRadius(CHIP_RADIUS);
            Row.backgroundColor(this.itemBackgroundColor(tab.id));
            Row.border({ width: this.isActive(tab.id) ? 0.6 : 0, color: this.itemBorderColor(tab.id) });
            Row.shadow({
                radius: 0,
                color: this.itemShadowColor(tab.id),
                offsetX: 0,
                offsetY: 0,
            });
            Context.animation(null);
        }, Row);
        Row.pop();
        this.Icon.bind(this)(tab.id);
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(tab.label);
            Context.animation({ duration: 140, curve: Curve.EaseOut });
            Text.fontSize(BOTTOM_TAB_LABEL_SIZE);
            Text.fontWeight(this.labelWeight(tab.id));
            Text.fontColor(this.labelColor(tab.id));
            Context.animation(null);
        }, Text);
        Text.pop();
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height(this.containerHeight());
            Stack.padding({ bottom: BOTTOM_TAB_FLOAT_GAP + this.bottomAvoidArea });
            Stack.backgroundColor(Color.Transparent);
        }, Stack);
        this.DockShell.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 0 });
            Row.width(BOTTOM_TAB_BAR_WIDTH);
            Row.height(BOTTOM_TAB_BAR_HEIGHT);
            Row.padding({ left: 2, right: 2 });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const tab = _item;
                this.TabButton.bind(this)(tab);
            };
            this.forEachUpdateFunction(elmtId, ROOT_TABS, forEachItemGenFunction, (tab: RootTabDefinition) => tab.id, false, false);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

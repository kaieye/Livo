if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface BottomTabs_Params {
    activeTab?: RootTabId;
    theme?: ThemePalette;
}
import router from "@ohos:router";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
export type RootTabId = 'home' | 'subscriptions' | 'discover' | 'settings';
interface TabDefinition {
    id: RootTabId;
    label: string;
    route: string;
}
const ROOT_TABS: TabDefinition[] = [
    { id: 'home', label: '首页', route: 'pages/Index' },
    { id: 'subscriptions', label: '订阅', route: 'pages/Subscriptions' },
    { id: 'discover', label: '发现', route: 'pages/Discover' },
    { id: 'settings', label: '设置', route: 'pages/Settings' },
];
export class BottomTabs extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__activeTab = new SynchedPropertySimpleOneWayPU(params.activeTab, this, "activeTab");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
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
    }
    updateStateVars(params: BottomTabs_Params) {
        this.__activeTab.reset(params.activeTab);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__activeTab.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__activeTab.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
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
    private isActive(tabId: RootTabId): boolean {
        return this.activeTab === tabId;
    }
    private labelColor(tabId: RootTabId): string {
        return this.isActive(tabId) ? this.theme.accent : this.theme.tabBarInactive;
    }
    private iconColor(tabId: RootTabId): string {
        return this.isActive(tabId) ? this.theme.accent : this.theme.tabBarInactive;
    }
    private navigate(route: string, tabId: RootTabId): void {
        if (this.activeTab === tabId) {
            return;
        }
        router.replaceUrl({ url: route });
    }
    private HomeIcon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 0 });
            Column.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(45:5)", "entry");
            Column.width(24);
            Column.height(24);
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(46:7)", "entry");
            Row.width(16);
            Row.height(8);
            Row.backgroundColor(this.iconColor(tabId));
            Row.borderRadius({ topLeft: 999, topRight: 999, bottomLeft: 4, bottomRight: 4 });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(52:7)", "entry");
            Row.width(20);
            Row.height(12);
            Row.backgroundColor(this.iconColor(tabId));
            Row.borderRadius(5);
            Row.margin({ top: -1 });
        }, Row);
        Row.pop();
        Column.pop();
    }
    private BagIcon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(67:5)", "entry");
            Stack.width(24);
            Stack.height(24);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 0 });
            Column.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(68:7)", "entry");
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(69:9)", "entry");
            Row.width(14);
            Row.height(5);
            Row.border({
                width: 2,
                color: this.iconColor(tabId),
            });
            Row.borderRadius({ topLeft: 999, topRight: 999, bottomLeft: 0, bottomRight: 0 });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(78:9)", "entry");
            Row.width(20);
            Row.height(14);
            Row.border({ width: 2, color: this.iconColor(tabId) });
            Row.borderRadius(5);
            Row.margin({ top: -1 });
        }, Row);
        Row.pop();
        Column.pop();
        Stack.pop();
    }
    private SearchIcon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(92:5)", "entry");
            Stack.width(24);
            Stack.height(24);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(93:7)", "entry");
            Row.width(16);
            Row.height(16);
            Row.borderRadius(999);
            Row.border({ width: 2, color: this.iconColor(tabId) });
            Row.margin({ left: -4, top: -4 });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(100:7)", "entry");
            Row.width(8);
            Row.height(2.5);
            Row.borderRadius(999);
            Row.backgroundColor(this.iconColor(tabId));
            Row.rotate({ angle: 45 });
            Row.margin({ left: 8, top: 8 });
        }, Row);
        Row.pop();
        Stack.pop();
    }
    private SettingsIcon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(114:5)", "entry");
            Stack.width(24);
            Stack.height(24);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(115:7)", "entry");
            Row.width(18);
            Row.height(18);
            Row.borderRadius(999);
            Row.border({ width: 2, color: this.iconColor(tabId) });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(121:7)", "entry");
            Row.width(6);
            Row.height(6);
            Row.borderRadius(999);
            Row.backgroundColor(this.iconColor(tabId));
        }, Row);
        Row.pop();
        Stack.pop();
    }
    private Icon(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (tabId === 'home') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.HomeIcon.bind(this)(tabId);
                });
            }
            else if (tabId === 'subscriptions') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.BagIcon.bind(this)(tabId);
                });
            }
            else if (tabId === 'discover') {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.SearchIcon.bind(this)(tabId);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    this.SettingsIcon.bind(this)(tabId);
                });
            }
        }, If);
        If.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(145:5)", "entry");
            Stack.width('100%');
            Stack.padding({ bottom: 12 });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(146:7)", "entry");
            Row.width('94%');
            Row.height(64);
            Row.backgroundColor(this.theme.tabBarBackground);
            Row.borderRadius(999);
            Row.border({ width: 0.6, color: this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' });
            Row.shadow({
                radius: 14,
                color: this.theme.isDark ? 'rgba(0, 0, 0, 0.30)' : 'rgba(15, 23, 42, 0.16)',
                offsetX: 0,
                offsetY: 6,
            });
        }, Row);
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(159:7)", "entry");
            Column.width('100%');
            Column.padding({ left: 14, right: 14, top: 8, bottom: 8 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 0 });
            Row.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(160:9)", "entry");
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const tab = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Column.create({ space: 3 });
                    Column.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(162:13)", "entry");
                    Column.width('25%');
                    Column.height(42);
                    Column.justifyContent(FlexAlign.Center);
                    Column.alignItems(HorizontalAlign.Center);
                    Column.onClick(() => this.navigate(tab.route, tab.id));
                }, Column);
                this.Icon.bind(this)(tab.id);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(tab.label);
                    Text.debugLine("entry/src/main/ets/common/components/BottomTabs.ets(165:15)", "entry");
                    Text.fontSize(11);
                    Text.fontWeight(this.isActive(tab.id) ? FontWeight.Medium : FontWeight.Regular);
                    Text.fontColor(this.labelColor(tab.id));
                }, Text);
                Text.pop();
                Column.pop();
            };
            this.forEachUpdateFunction(elmtId, ROOT_TABS, forEachItemGenFunction, (tab: TabDefinition) => tab.id, false, false);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Column.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

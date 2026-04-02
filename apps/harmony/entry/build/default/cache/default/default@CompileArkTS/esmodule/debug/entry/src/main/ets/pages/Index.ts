if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Index_Params {
    topAvoidArea?: number;
    discoverOverlayLevel?: number;
    discoverHasForegroundOverlay?: boolean;
    subscriptionsOverlayLevel?: number;
    settingsOverlayLevel?: number;
    feedsChangedAt?: number;
    featuredEntries?: EntryCardModel[];
    feedSourceLabel?: string;
    isRefreshing?: boolean;
    searchQuery?: string;
    showSearch?: boolean;
    searchExpanded?: boolean;
    searchInputController?: TextInputController;
    mode?: SubscriptionMode;
    renderedMode?: SubscriptionMode;
    previousMode?: SubscriptionMode;
    isModeTransitioning?: boolean;
    modeTransitionDirection?: number;
    theme?: ThemePalette;
    rootTabIndex?: number;
    activeRootTabId?: RootTabId;
    highlightedRootTabId?: RootTabId;
    previousRootTabId?: RootTabId;
    isRootTransitioning?: boolean;
    pendingRootTabId?: RootTabId;
    rootTransitionVersion?: number;
    modeTransitionVersion?: number;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import type { KeyboardAvoidMode } from "@ohos:arkui.UIContext";
import type window from "@ohos:window";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { getRequestedRootTabId, openArticleDetail, rootTabIndexForId } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import type { RootTabId } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { ContentModeRail } from "@bundle:com.livo.harmony/entry/ets/common/components/ContentModeRail";
import { HomeVideoGrid } from "@bundle:com.livo.harmony/entry/ets/common/components/HomeVideoGrid";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { PictureEntryCard } from "@bundle:com.livo.harmony/entry/ets/common/components/PictureEntryCard";
import { TweetEntryCard } from "@bundle:com.livo.harmony/entry/ets/common/components/TweetEntryCard";
import { selectPictureMediaUrls } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, EntryCardModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { resolveHomeVideoSceneKind } from "@bundle:com.livo.harmony/entry/ets/common/utils/HomeVideoGrid";
import { presentTweetEntryFromCard } from "@bundle:com.livo.harmony/entry/ets/common/utils/TweetEntryPresentation";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { CARD_RADIUS_MD, INPUT_RADIUS, PAGE_TOP_PADDING, PAGE_HORIZONTAL_PADDING, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
import { SubscriptionsContent } from "@bundle:com.livo.harmony/entry/ets/common/components/SubscriptionsContent";
import { DiscoverContent } from "@bundle:com.livo.harmony/entry/ets/common/components/DiscoverContent";
import { SettingsContent } from "@bundle:com.livo.harmony/entry/ets/common/components/SettingsContent";
type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos';
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos'];
const MODE_SCENE_DURATION: number = 240;
const MODE_SWIPE_TRIGGER_OFFSET: number = 56;
class Index extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__topAvoidArea = this.createStorageProp('topAvoidArea', 0, "topAvoidArea");
        this.__discoverOverlayLevel = this.createStorageProp('discoverOverlayLevel', 0, "discoverOverlayLevel");
        this.__discoverHasForegroundOverlay = this.createStorageProp('discoverHasForegroundOverlay', false, "discoverHasForegroundOverlay");
        this.__subscriptionsOverlayLevel = this.createStorageProp('subscriptionsOverlayLevel', 0, "subscriptionsOverlayLevel");
        this.__settingsOverlayLevel = this.createStorageProp('settingsOverlayLevel', 0, "settingsOverlayLevel");
        this.__feedsChangedAt = this.createStorageProp('feedsChangedAt', 0, "feedsChangedAt");
        this.__featuredEntries = new ObservedPropertyObjectPU([], this, "featuredEntries");
        this.__feedSourceLabel = new ObservedPropertySimplePU('准备加载本地内容', this, "feedSourceLabel");
        this.__isRefreshing = new ObservedPropertySimplePU(false, this, "isRefreshing");
        this.__searchQuery = new ObservedPropertySimplePU('', this, "searchQuery");
        this.__showSearch = new ObservedPropertySimplePU(false, this, "showSearch");
        this.__searchExpanded = new ObservedPropertySimplePU(false, this, "searchExpanded");
        this.searchInputController = new TextInputController();
        this.__mode = new ObservedPropertySimplePU('articles', this, "mode");
        this.__renderedMode = new ObservedPropertySimplePU('articles', this, "renderedMode");
        this.__previousMode = new ObservedPropertySimplePU('articles', this, "previousMode");
        this.__isModeTransitioning = new ObservedPropertySimplePU(false, this, "isModeTransitioning");
        this.__modeTransitionDirection = new ObservedPropertySimplePU(1, this, "modeTransitionDirection");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__rootTabIndex = new ObservedPropertySimplePU(0, this, "rootTabIndex");
        this.__activeRootTabId = new ObservedPropertySimplePU('home', this, "activeRootTabId");
        this.__highlightedRootTabId = new ObservedPropertySimplePU('home', this, "highlightedRootTabId");
        this.__previousRootTabId = new ObservedPropertySimplePU('home', this, "previousRootTabId");
        this.__isRootTransitioning = new ObservedPropertySimplePU(false, this, "isRootTransitioning");
        this.pendingRootTabId = 'home';
        this.rootTransitionVersion = 0;
        this.modeTransitionVersion = 0;
        this.setInitiallyProvidedValue(params);
        this.declareWatch("feedsChangedAt", this.handleFeedsChanged);
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
        if (params.searchExpanded !== undefined) {
            this.searchExpanded = params.searchExpanded;
        }
        if (params.searchInputController !== undefined) {
            this.searchInputController = params.searchInputController;
        }
        if (params.mode !== undefined) {
            this.mode = params.mode;
        }
        if (params.renderedMode !== undefined) {
            this.renderedMode = params.renderedMode;
        }
        if (params.previousMode !== undefined) {
            this.previousMode = params.previousMode;
        }
        if (params.isModeTransitioning !== undefined) {
            this.isModeTransitioning = params.isModeTransitioning;
        }
        if (params.modeTransitionDirection !== undefined) {
            this.modeTransitionDirection = params.modeTransitionDirection;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.rootTabIndex !== undefined) {
            this.rootTabIndex = params.rootTabIndex;
        }
        if (params.activeRootTabId !== undefined) {
            this.activeRootTabId = params.activeRootTabId;
        }
        if (params.highlightedRootTabId !== undefined) {
            this.highlightedRootTabId = params.highlightedRootTabId;
        }
        if (params.previousRootTabId !== undefined) {
            this.previousRootTabId = params.previousRootTabId;
        }
        if (params.isRootTransitioning !== undefined) {
            this.isRootTransitioning = params.isRootTransitioning;
        }
        if (params.pendingRootTabId !== undefined) {
            this.pendingRootTabId = params.pendingRootTabId;
        }
        if (params.rootTransitionVersion !== undefined) {
            this.rootTransitionVersion = params.rootTransitionVersion;
        }
        if (params.modeTransitionVersion !== undefined) {
            this.modeTransitionVersion = params.modeTransitionVersion;
        }
    }
    updateStateVars(params: Index_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__topAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__discoverHasForegroundOverlay.purgeDependencyOnElmtId(rmElmtId);
        this.__subscriptionsOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__settingsOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__feedsChangedAt.purgeDependencyOnElmtId(rmElmtId);
        this.__featuredEntries.purgeDependencyOnElmtId(rmElmtId);
        this.__feedSourceLabel.purgeDependencyOnElmtId(rmElmtId);
        this.__isRefreshing.purgeDependencyOnElmtId(rmElmtId);
        this.__searchQuery.purgeDependencyOnElmtId(rmElmtId);
        this.__showSearch.purgeDependencyOnElmtId(rmElmtId);
        this.__searchExpanded.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__renderedMode.purgeDependencyOnElmtId(rmElmtId);
        this.__previousMode.purgeDependencyOnElmtId(rmElmtId);
        this.__isModeTransitioning.purgeDependencyOnElmtId(rmElmtId);
        this.__modeTransitionDirection.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__rootTabIndex.purgeDependencyOnElmtId(rmElmtId);
        this.__activeRootTabId.purgeDependencyOnElmtId(rmElmtId);
        this.__highlightedRootTabId.purgeDependencyOnElmtId(rmElmtId);
        this.__previousRootTabId.purgeDependencyOnElmtId(rmElmtId);
        this.__isRootTransitioning.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__topAvoidArea.aboutToBeDeleted();
        this.__discoverOverlayLevel.aboutToBeDeleted();
        this.__discoverHasForegroundOverlay.aboutToBeDeleted();
        this.__subscriptionsOverlayLevel.aboutToBeDeleted();
        this.__settingsOverlayLevel.aboutToBeDeleted();
        this.__feedsChangedAt.aboutToBeDeleted();
        this.__featuredEntries.aboutToBeDeleted();
        this.__feedSourceLabel.aboutToBeDeleted();
        this.__isRefreshing.aboutToBeDeleted();
        this.__searchQuery.aboutToBeDeleted();
        this.__showSearch.aboutToBeDeleted();
        this.__searchExpanded.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
        this.__renderedMode.aboutToBeDeleted();
        this.__previousMode.aboutToBeDeleted();
        this.__isModeTransitioning.aboutToBeDeleted();
        this.__modeTransitionDirection.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__rootTabIndex.aboutToBeDeleted();
        this.__activeRootTabId.aboutToBeDeleted();
        this.__highlightedRootTabId.aboutToBeDeleted();
        this.__previousRootTabId.aboutToBeDeleted();
        this.__isRootTransitioning.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __topAvoidArea: ObservedPropertyAbstractPU<number>;
    get topAvoidArea() {
        return this.__topAvoidArea.get();
    }
    set topAvoidArea(newValue: number) {
        this.__topAvoidArea.set(newValue);
    }
    private __discoverOverlayLevel: ObservedPropertyAbstractPU<number>;
    get discoverOverlayLevel() {
        return this.__discoverOverlayLevel.get();
    }
    set discoverOverlayLevel(newValue: number) {
        this.__discoverOverlayLevel.set(newValue);
    }
    private __discoverHasForegroundOverlay: ObservedPropertyAbstractPU<boolean>;
    get discoverHasForegroundOverlay() {
        return this.__discoverHasForegroundOverlay.get();
    }
    set discoverHasForegroundOverlay(newValue: boolean) {
        this.__discoverHasForegroundOverlay.set(newValue);
    }
    private __subscriptionsOverlayLevel: ObservedPropertyAbstractPU<number>;
    get subscriptionsOverlayLevel() {
        return this.__subscriptionsOverlayLevel.get();
    }
    set subscriptionsOverlayLevel(newValue: number) {
        this.__subscriptionsOverlayLevel.set(newValue);
    }
    private __settingsOverlayLevel: ObservedPropertyAbstractPU<number>;
    get settingsOverlayLevel() {
        return this.__settingsOverlayLevel.get();
    }
    set settingsOverlayLevel(newValue: number) {
        this.__settingsOverlayLevel.set(newValue);
    }
    private __feedsChangedAt: ObservedPropertyAbstractPU<number>;
    get feedsChangedAt() {
        return this.__feedsChangedAt.get();
    }
    set feedsChangedAt(newValue: number) {
        this.__feedsChangedAt.set(newValue);
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
    private __searchExpanded: ObservedPropertySimplePU<boolean>;
    get searchExpanded() {
        return this.__searchExpanded.get();
    }
    set searchExpanded(newValue: boolean) {
        this.__searchExpanded.set(newValue);
    }
    private searchInputController: TextInputController;
    private __mode: ObservedPropertySimplePU<SubscriptionMode>;
    get mode() {
        return this.__mode.get();
    }
    set mode(newValue: SubscriptionMode) {
        this.__mode.set(newValue);
    }
    private __renderedMode: ObservedPropertySimplePU<SubscriptionMode>;
    get renderedMode() {
        return this.__renderedMode.get();
    }
    set renderedMode(newValue: SubscriptionMode) {
        this.__renderedMode.set(newValue);
    }
    private __previousMode: ObservedPropertySimplePU<SubscriptionMode>;
    get previousMode() {
        return this.__previousMode.get();
    }
    set previousMode(newValue: SubscriptionMode) {
        this.__previousMode.set(newValue);
    }
    private __isModeTransitioning: ObservedPropertySimplePU<boolean>;
    get isModeTransitioning() {
        return this.__isModeTransitioning.get();
    }
    set isModeTransitioning(newValue: boolean) {
        this.__isModeTransitioning.set(newValue);
    }
    private __modeTransitionDirection: ObservedPropertySimplePU<number>;
    get modeTransitionDirection() {
        return this.__modeTransitionDirection.get();
    }
    set modeTransitionDirection(newValue: number) {
        this.__modeTransitionDirection.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __rootTabIndex: ObservedPropertySimplePU<number>;
    get rootTabIndex() {
        return this.__rootTabIndex.get();
    }
    set rootTabIndex(newValue: number) {
        this.__rootTabIndex.set(newValue);
    }
    private __activeRootTabId: ObservedPropertySimplePU<RootTabId>;
    get activeRootTabId() {
        return this.__activeRootTabId.get();
    }
    set activeRootTabId(newValue: RootTabId) {
        this.__activeRootTabId.set(newValue);
    }
    private __highlightedRootTabId: ObservedPropertySimplePU<RootTabId>;
    get highlightedRootTabId() {
        return this.__highlightedRootTabId.get();
    }
    set highlightedRootTabId(newValue: RootTabId) {
        this.__highlightedRootTabId.set(newValue);
    }
    private __previousRootTabId: ObservedPropertySimplePU<RootTabId>;
    get previousRootTabId() {
        return this.__previousRootTabId.get();
    }
    set previousRootTabId(newValue: RootTabId) {
        this.__previousRootTabId.set(newValue);
    }
    private __isRootTransitioning: ObservedPropertySimplePU<boolean>;
    get isRootTransitioning() {
        return this.__isRootTransitioning.get();
    }
    set isRootTransitioning(newValue: boolean) {
        this.__isRootTransitioning.set(newValue);
    }
    private pendingRootTabId: RootTabId;
    private rootTransitionVersion: number;
    private modeTransitionVersion: number;
    private animateWithUiContext(options: AnimateParam, event: () => void): void {
        this.getUIContext().animateTo(options, event);
    }
    aboutToAppear(): void {
        console.info('Livo Harmony Index aboutToAppear');
        this.syncRequestedRootTab();
        this.updateKeyboardAvoidMode(0);
        void this.loadInitialData();
    }
    aboutToDisappear(): void {
        this.updateKeyboardAvoidMode(0);
    }
    private async loadInitialData(): Promise<void> {
        this.theme = ThemeService.currentPalette();
        void this.applySystemBarStyle(this.theme);
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
        void this.applySystemBarStyle(this.theme);
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
    private refreshRootTheme(): void {
        this.theme = ThemeService.currentPalette();
        void this.applySystemBarStyle(this.theme);
    }
    private async applySystemBarStyle(theme: ThemePalette): Promise<void> {
        const mainWindow = AppStorage.get<window.Window>('WindowClass');
        if (!mainWindow) {
            return;
        }
        try {
            await mainWindow.setWindowSystemBarProperties({
                statusBarColor: '#00000000',
                navigationBarColor: '#00000000',
                isStatusBarLightIcon: theme.isDark,
            });
        }
        catch (_) {
        }
    }
    private syncRequestedRootTab(): void {
        const requestedTab = getRequestedRootTabId();
        if (!requestedTab) {
            return;
        }
        this.previousRootTabId = requestedTab;
        this.isRootTransitioning = false;
        this.activeRootTabId = requestedTab;
        this.highlightedRootTabId = requestedTab;
        this.pendingRootTabId = requestedTab;
        this.rootTabIndex = rootTabIndexForId(requestedTab);
    }
    private requestRootTabSwitch(tabId: RootTabId): void {
        const nextIndex = rootTabIndexForId(tabId);
        if (tabId === this.highlightedRootTabId && nextIndex === this.rootTabIndex) {
            return;
        }
        this.highlightedRootTabId = tabId;
        this.pendingRootTabId = tabId;
        this.startRootTabTransition(tabId, nextIndex);
    }
    private startRootTabTransition(tabId: RootTabId, nextIndex: number): void {
        const currentTabId = this.activeRootTabId;
        const currentIndex = this.rootTabIndex;
        if (currentTabId === tabId && currentIndex === nextIndex) {
            return;
        }
        this.rootTransitionVersion += 1;
        const version = this.rootTransitionVersion;
        this.previousRootTabId = currentTabId;
        this.isRootTransitioning = true;
        this.activeRootTabId = tabId;
        this.rootTabIndex = nextIndex;
        this.refreshRootTheme();
        setTimeout(() => {
            if (version !== this.rootTransitionVersion) {
                return;
            }
            this.previousRootTabId = tabId;
            this.isRootTransitioning = false;
            if (this.highlightedRootTabId !== this.activeRootTabId) {
                this.highlightedRootTabId = this.activeRootTabId;
            }
        }, livoMotion.rootSceneDuration());
    }
    private openEntry(entryId: string): void {
        void openArticleDetail(entryId);
    }
    private sceneVisible(tabId: RootTabId): Visibility {
        if (tabId === this.activeRootTabId) {
            return Visibility.Visible;
        }
        if (this.isRootTransitioning && tabId === this.previousRootTabId) {
            return Visibility.Visible;
        }
        return Visibility.Hidden;
    }
    private sceneOffset(tabId: RootTabId): number {
        return livoMotion.rootSceneOffset(this.rootTabIndex, rootTabIndexForId(tabId));
    }
    private sceneOpacity(tabId: RootTabId): number {
        return livoMotion.rootSceneOpacity(tabId === this.activeRootTabId);
    }
    private sceneScale(tabId: RootTabId): number {
        return livoMotion.rootSceneScale(tabId === this.activeRootTabId);
    }
    private sceneZIndex(tabId: RootTabId): number {
        if (tabId === this.activeRootTabId) {
            return 2;
        }
        if (this.isRootTransitioning && tabId === this.previousRootTabId) {
            return 1;
        }
        return 0;
    }
    private RootScene(tabId: RootTabId, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Context.animation({
                duration: livoMotion.rootSceneDuration(),
                curve: livoMotion.rootSceneCurve(),
            });
            Stack.width('100%');
            Stack.height('100%');
            Stack.visibility(this.sceneVisible(tabId));
            Stack.opacity(this.sceneOpacity(tabId));
            Stack.translate({ x: this.sceneOffset(tabId) });
            Stack.zIndex(this.sceneZIndex(tabId));
            Context.animation(null);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (tabId === 'home') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.HomeRootPage.bind(this)();
                });
            }
            else if (tabId === 'subscriptions') {
                this.ifElseBranchUpdateFunction(1, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new SubscriptionsContent(this, {
                                    showBottomTabs: false,
                                    inheritedTheme: this.theme,
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 222, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        showBottomTabs: false,
                                        inheritedTheme: this.theme
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    showBottomTabs: false,
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "SubscriptionsContent" });
                    }
                });
            }
            else if (tabId === 'discover') {
                this.ifElseBranchUpdateFunction(2, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new DiscoverContent(this, {
                                    showBottomTabs: false,
                                    reserveBottomTabInset: true,
                                    inheritedTheme: this.theme,
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 227, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        showBottomTabs: false,
                                        reserveBottomTabInset: true,
                                        inheritedTheme: this.theme
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    showBottomTabs: false,
                                    reserveBottomTabInset: true,
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "DiscoverContent" });
                    }
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new SettingsContent(this, {
                                    showBottomTabs: false,
                                    inheritedTheme: this.theme,
                                    onThemeChange: (theme: ThemePalette) => {
                                        this.theme = theme;
                                        void this.applySystemBarStyle(theme);
                                    },
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 233, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        showBottomTabs: false,
                                        inheritedTheme: this.theme,
                                        onThemeChange: (theme: ThemePalette) => {
                                            this.theme = theme;
                                            void this.applySystemBarStyle(theme);
                                        }
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    showBottomTabs: false,
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "SettingsContent" });
                    }
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private modeIndex(mode: SubscriptionMode): number {
        return SUBSCRIPTION_MODES.indexOf(mode);
    }
    private requestModeSwitch(nextMode: SubscriptionMode): void {
        if (nextMode === this.mode) {
            return;
        }
        this.mode = nextMode;
        this.startModeTransition(nextMode);
    }
    private startModeTransition(nextMode: SubscriptionMode): void {
        const currentMode = this.renderedMode;
        if (currentMode === nextMode) {
            this.previousMode = nextMode;
            this.isModeTransitioning = false;
            return;
        }
        this.modeTransitionVersion += 1;
        const version = this.modeTransitionVersion;
        this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(currentMode) ? 1 : -1;
        this.previousMode = currentMode;
        this.renderedMode = nextMode;
        this.isModeTransitioning = true;
        setTimeout(() => {
            if (version !== this.modeTransitionVersion) {
                return;
            }
            this.previousMode = nextMode;
            this.isModeTransitioning = false;
        }, MODE_SCENE_DURATION);
    }
    private adjacentMode(offsetX: number): SubscriptionMode | undefined {
        const currentIndex = this.modeIndex(this.mode);
        if (currentIndex < 0) {
            return undefined;
        }
        const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
            return undefined;
        }
        return SUBSCRIPTION_MODES[nextIndex];
    }
    private handleModeSwipe(event: GestureEvent): void {
        if (this.isModeTransitioning) {
            return;
        }
        const offsetX = event.offsetX;
        const offsetY = event.offsetY;
        if (Math.abs(offsetX) < MODE_SWIPE_TRIGGER_OFFSET || Math.abs(offsetX) <= Math.abs(offsetY)) {
            return;
        }
        const nextMode = this.adjacentMode(offsetX);
        if (nextMode) {
            this.requestModeSwitch(nextMode);
        }
    }
    private filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
        return this.featuredEntries.filter((entry: EntryCardModel) => entry.viewLabel === this.getModeTitle(mode));
    }
    private handleFeedsChanged(): void {
        void this.reloadFeaturedEntriesFromLocal();
    }
    private async reloadFeaturedEntriesFromLocal(): Promise<void> {
        this.featuredEntries = await AppRepository.featuredEntries();
        this.feedSourceLabel = '本地内容已同步';
    }
    private filteredEntries(): EntryCardModel[] {
        return this.filteredEntriesFor(this.mode);
    }
    private pictureCaption(entry: EntryCardModel): string {
        const title = (entry.title || '').trim();
        if (title && title !== '远程条目') {
            return title;
        }
        return (entry.summary || '').trim();
    }
    private pictureGalleryUrls(entry: EntryCardModel): string[] {
        return selectPictureMediaUrls(entry.mediaUrls ?? []);
    }
    private pictureCardEntry(entry: EntryCardModel): Entry {
        return {
            id: entry.id,
            feedId: entry.feedId,
            title: entry.title,
            url: entry.articleUrl,
            summary: entry.summary,
            content: '',
            author: entry.author,
            publishedAt: entry.publishedAt,
            readingTimeMinutes: 0,
            tags: entry.tags,
            mediaUrls: entry.mediaUrls ?? [],
            isRead: entry.isRead,
            isStarred: entry.isStarred,
            createdAt: entry.publishedAt,
            updatedAt: entry.publishedAt,
        };
    }
    private searchAllEntries(): EntryCardModel[] {
        const keyword = this.searchQuery.trim().toLowerCase();
        if (!keyword) {
            return [];
        }
        return this.featuredEntries.filter((entry: EntryCardModel) => entry.title.toLowerCase().includes(keyword)
            || entry.summary.toLowerCase().includes(keyword)
            || entry.feedTitle.toLowerCase().includes(keyword));
    }
    private hasSearchEmptyState(): boolean {
        return !!this.searchQuery.trim() && this.searchAllEntries().length === 0;
    }
    private searchPanelHeight(): number {
        const resultCount = this.searchAllEntries().length;
        if (resultCount === 0) {
            return 132;
        }
        const visibleCount = this.searchExpanded ? Math.min(resultCount, 6) : Math.min(resultCount, 3);
        return visibleCount * 90 + (visibleCount - 1) * 8 + 16;
    }
    private getMatchedContent(text: string, keyword: string, maxLength: number = 60): string {
        if (!keyword || !text) {
            return '';
        }
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        const index = lowerText.indexOf(lowerKeyword);
        if (index === -1) {
            return '';
        }
        const start = Math.max(0, index - 20);
        const end = Math.min(text.length, index + keyword.length + 30);
        let result = text.slice(start, end);
        if (start > 0) {
            result = '...' + result;
        }
        if (end < text.length) {
            result = result + '...';
        }
        return result;
    }
    private findHighlightIndex(text: string, keyword: string): number {
        if (!keyword || !text) {
            return -1;
        }
        return text.toLowerCase().indexOf(keyword.toLowerCase());
    }
    private getMatchedContentPrefix(text: string, keyword: string): string {
        if (!keyword || !text) {
            return '';
        }
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        const index = lowerText.indexOf(lowerKeyword);
        if (index === -1) {
            return '';
        }
        const start = Math.max(0, index - 20);
        let prefix = text.slice(start, index);
        if (start > 0) {
            prefix = '...' + prefix;
        }
        return prefix;
    }
    private getMatchedContentSuffix(text: string, keyword: string): string {
        if (!keyword || !text) {
            return '';
        }
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        const index = lowerText.indexOf(lowerKeyword);
        if (index === -1) {
            return '';
        }
        const end = Math.min(text.length, index + keyword.length + 30);
        let suffix = text.slice(index + keyword.length, end);
        if (end < text.length) {
            suffix = suffix + '...';
        }
        return suffix;
    }
    private HighlightTitle(title: string, keyword: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!keyword || this.findHighlightIndex(title, keyword) < 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(title);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textPrimary);
                        Text.maxLines(2);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.layoutWeight(1);
                    }, Text);
                    Text.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create();
                        Text.maxLines(2);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.layoutWeight(1);
                    }, Text);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Span.create(title.slice(0, this.findHighlightIndex(title, keyword)));
                        Span.fontSize(14);
                        Span.fontColor(this.theme.textPrimary);
                    }, Span);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Span.create(title.slice(this.findHighlightIndex(title, keyword), this.findHighlightIndex(title, keyword) + keyword.length));
                        Span.fontSize(14);
                        Span.fontColor(this.theme.accent);
                        Span.fontWeight(FontWeight.Medium);
                    }, Span);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Span.create(title.slice(this.findHighlightIndex(title, keyword) + keyword.length));
                        Span.fontSize(14);
                        Span.fontColor(this.theme.textPrimary);
                    }, Span);
                    Text.pop();
                });
            }
        }, If);
        If.pop();
    }
    private HighlightSummary(summary: string, keyword: string, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create();
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
            Text.width('100%');
        }, Text);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Span.create(this.getMatchedContentPrefix(summary, keyword));
            Span.fontSize(12);
            Span.fontColor(this.theme.textSecondary);
        }, Span);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Span.create(keyword);
            Span.fontSize(12);
            Span.fontColor(this.theme.accent);
            Span.fontWeight(FontWeight.Medium);
        }, Span);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Span.create(this.getMatchedContentSuffix(summary, keyword));
            Span.fontSize(12);
            Span.fontColor(this.theme.textSecondary);
        }, Span);
        Text.pop();
    }
    private modeSceneVisible(mode: SubscriptionMode): Visibility {
        if (mode === this.renderedMode) {
            return Visibility.Visible;
        }
        if (this.isModeTransitioning && mode === this.previousMode) {
            return Visibility.Visible;
        }
        return Visibility.Hidden;
    }
    private modeSceneOpacity(mode: SubscriptionMode): number {
        return mode === this.renderedMode ? 1 : 0;
    }
    private modeSceneOffset(mode: SubscriptionMode): number {
        if (mode === this.renderedMode) {
            return 0;
        }
        if (!this.isModeTransitioning || mode !== this.previousMode) {
            return 0;
        }
        return this.modeTransitionDirection > 0 ? -16 : 16;
    }
    private modeSceneZIndex(mode: SubscriptionMode): number {
        if (mode === this.renderedMode) {
            return 2;
        }
        if (this.isModeTransitioning && mode === this.previousMode) {
            return 1;
        }
        return 0;
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
    private updateKeyboardAvoidMode(mode: KeyboardAvoidMode): void {
        try {
            this.getUIContext().setKeyboardAvoidMode(mode);
        }
        catch (_) {
        }
    }
    private openSearch(): void {
        if (this.showSearch) {
            return;
        }
        this.updateKeyboardAvoidMode(4);
        this.showSearch = true;
        setTimeout(() => {
            const focusController = this.getUIContext().getFocusController();
            focusController.requestFocus('home_search_input');
        }, 140);
    }
    private closeSearch(): void {
        if (!this.showSearch) {
            return;
        }
        this.updateKeyboardAvoidMode(0);
        this.animateWithUiContext({ duration: 260, curve: Curve.EaseIn }, () => {
            this.showSearch = false;
            this.searchQuery = '';
            this.searchExpanded = false;
        });
    }
    private EntryCard(entry: EntryCardModel, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({ left: 14, right: 14, top: 14, bottom: 14 });
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(20);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.shadow({
                radius: this.theme.isDark ? 10 : 14,
                color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
                offsetX: 0,
                offsetY: 4,
            });
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => this.openEntry(entry.id));
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
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.title);
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.lineHeight(22);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
    }
    private isXSocialEntry(entry: EntryCardModel): boolean {
        const articleUrl = (entry.articleUrl || '').toLowerCase();
        const feedTitle = (entry.feedTitle || '').toLowerCase();
        return articleUrl.includes('x.com/')
            || articleUrl.includes('twitter.com/')
            || feedTitle.includes('x / twitter');
    }
    private SocialEntryCard(entry: EntryCardModel, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isXSocialEntry(entry)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new TweetEntryCard(this, {
                                    presentation: presentTweetEntryFromCard(entry),
                                    theme: this.theme,
                                    onOpen: () => this.openEntry(entry.id),
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 656, col: 7 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        presentation: presentTweetEntryFromCard(entry),
                                        theme: this.theme,
                                        onOpen: () => this.openEntry(entry.id)
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    presentation: presentTweetEntryFromCard(entry),
                                    theme: this.theme
                                });
                            }
                        }, { name: "TweetEntryCard" });
                    }
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.EntryCard.bind(this)(entry);
                });
            }
        }, If);
        If.pop();
    }
    private EntryList(mode: SubscriptionMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            List.create({ space: 10 });
            List.width('100%');
            List.height('100%');
            List.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING });
            List.scrollBar(BarState.Off);
            List.edgeEffect(EdgeEffect.Spring);
        }, List);
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
                        ListItem.transition(livoMotion.enterSoft(index * 18 + 40));
                    };
                    const deepRenderFunction = (elmtId, isInitialRender) => {
                        itemCreation(elmtId, isInitialRender);
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            If.create();
                            if (mode === 'social') {
                                this.ifElseBranchUpdateFunction(0, () => {
                                    this.SocialEntryCard.bind(this)(entry);
                                });
                            }
                            else {
                                this.ifElseBranchUpdateFunction(1, () => {
                                    this.EntryCard.bind(this)(entry);
                                });
                            }
                        }, If);
                        If.pop();
                        ListItem.pop();
                    };
                    this.observeComponentCreation2(itemCreation2, ListItem);
                    ListItem.pop();
                }
            };
            this.forEachUpdateFunction(elmtId, this.filteredEntriesFor(mode), forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
        }, ForEach);
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredEntriesFor(mode).length === 0) {
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
                                Column.create({ space: 8 });
                                Column.alignItems(HorizontalAlign.Start);
                                Column.padding(20);
                                Column.backgroundColor(this.theme.surface);
                                Column.borderRadius(CARD_RADIUS_MD);
                                Column.border({ width: 0.8, color: this.theme.divider });
                                Column.width('100%');
                            }, Column);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create('还没有可展示的条目');
                                Text.fontSize(18);
                                Text.fontWeight(FontWeight.Bold);
                                Text.fontColor(this.theme.textPrimary);
                            }, Text);
                            Text.pop();
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create('请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。');
                                Text.fontSize(14);
                                Text.lineHeight(22);
                                Text.fontColor(this.theme.textSecondary);
                            }, Text);
                            Text.pop();
                            Column.pop();
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
    }
    private PictureEntryList(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            List.create({ space: 12 });
            List.width('100%');
            List.height('100%');
            List.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING });
            List.scrollBar(BarState.Off);
            List.edgeEffect(EdgeEffect.Spring);
        }, List);
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
                        {
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                if (isInitialRender) {
                                    let componentCall = new PictureEntryCard(this, {
                                        entry: this.pictureCardEntry(entry),
                                        index,
                                        authorLabel: entry.author || entry.feedTitle,
                                        feedImageUrl: entry.feedImageUrl,
                                        caption: this.pictureCaption(entry),
                                        pictureUrl: entry.imageUrl,
                                        galleryUrls: this.pictureGalleryUrls(entry),
                                        theme: this.theme,
                                        onOpen: () => this.openEntry(entry.id),
                                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 719, col: 11 });
                                    ViewPU.create(componentCall);
                                    let paramsLambda = () => {
                                        return {
                                            entry: this.pictureCardEntry(entry),
                                            index,
                                            authorLabel: entry.author || entry.feedTitle,
                                            feedImageUrl: entry.feedImageUrl,
                                            caption: this.pictureCaption(entry),
                                            pictureUrl: entry.imageUrl,
                                            galleryUrls: this.pictureGalleryUrls(entry),
                                            theme: this.theme,
                                            onOpen: () => this.openEntry(entry.id)
                                        };
                                    };
                                    componentCall.paramsGenerator_ = paramsLambda;
                                }
                                else {
                                    this.updateStateVarsOfChildByElmtId(elmtId, {
                                        entry: this.pictureCardEntry(entry),
                                        index,
                                        authorLabel: entry.author || entry.feedTitle,
                                        feedImageUrl: entry.feedImageUrl,
                                        caption: this.pictureCaption(entry),
                                        pictureUrl: entry.imageUrl,
                                        galleryUrls: this.pictureGalleryUrls(entry),
                                        theme: this.theme
                                    });
                                }
                            }, { name: "PictureEntryCard" });
                        }
                        ListItem.pop();
                    };
                    this.observeComponentCreation2(itemCreation2, ListItem);
                    ListItem.pop();
                }
            };
            this.forEachUpdateFunction(elmtId, this.filteredEntriesFor('pictures'), forEachItemGenFunction, (entry: EntryCardModel) => entry.id, true, false);
        }, ForEach);
        ForEach.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredEntriesFor('pictures').length === 0) {
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
                                Column.create({ space: 8 });
                                Column.alignItems(HorizontalAlign.Start);
                                Column.padding(20);
                                Column.backgroundColor(this.theme.surface);
                                Column.borderRadius(CARD_RADIUS_MD);
                                Column.border({ width: 0.8, color: this.theme.divider });
                                Column.width('100%');
                            }, Column);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create('还没有可展示的条目');
                                Text.fontSize(18);
                                Text.fontWeight(FontWeight.Bold);
                                Text.fontColor(this.theme.textPrimary);
                            }, Text);
                            Text.pop();
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create('请先到订阅页添加或刷新订阅源，然后回到首页查看整理后的内容流。');
                                Text.fontSize(14);
                                Text.lineHeight(22);
                                Text.fontColor(this.theme.textSecondary);
                            }, Text);
                            Text.pop();
                            Column.pop();
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
    }
    private ModeEntriesScene(mode: SubscriptionMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Context.animation({
                duration: MODE_SCENE_DURATION,
                curve: Curve.EaseInOut,
            });
            Stack.width('100%');
            Stack.height('100%');
            Stack.visibility(this.modeSceneVisible(mode));
            Stack.opacity(this.modeSceneOpacity(mode));
            Stack.translate({ x: this.modeSceneOffset(mode) });
            Stack.zIndex(this.modeSceneZIndex(mode));
            Context.animation(null);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (resolveHomeVideoSceneKind(mode) === 'grid') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Scroll.create();
                        Scroll.width('100%');
                        Scroll.height('100%');
                        Scroll.scrollBar(BarState.Off);
                        Scroll.edgeEffect(EdgeEffect.Spring);
                    }, Scroll);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 0 });
                        Column.width('100%');
                        Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, bottom: 100 });
                    }, Column);
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new HomeVideoGrid(this, {
                                    entries: this.filteredEntriesFor(mode),
                                    inheritedTheme: this.theme,
                                    onOpenEntry: (entry: EntryCardModel) => {
                                        this.openEntry(entry.id);
                                    },
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 773, col: 13 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        entries: this.filteredEntriesFor(mode),
                                        inheritedTheme: this.theme,
                                        onOpenEntry: (entry: EntryCardModel) => {
                                            this.openEntry(entry.id);
                                        }
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    entries: this.filteredEntriesFor(mode),
                                    inheritedTheme: this.theme
                                });
                            }
                        }, { name: "HomeVideoGrid" });
                    }
                    Column.pop();
                    Scroll.pop();
                });
            }
            else if (mode === 'pictures') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.PictureEntryList.bind(this)();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.EntryList.bind(this)(mode);
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    private HomeRootPage(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor(this.theme.background);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 10 });
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '今日推荐',
                        theme: this.theme,
                        trailingSymbol: { "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
                        trailingButtonCircular: true,
                        trailingSymbolSize: 22,
                        trailingSymbolColor: this.theme.isDark ? '#E6EDF7' : '#1F2937',
                        trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9',
                        onTrailingClick: () => {
                            if (this.showSearch) {
                                this.closeSearch();
                                return;
                            }
                            this.openSearch();
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 810, col: 9 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '今日推荐',
                            theme: this.theme,
                            trailingSymbol: { "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
                            trailingButtonCircular: true,
                            trailingSymbolSize: 22,
                            trailingSymbolColor: this.theme.isDark ? '#E6EDF7' : '#1F2937',
                            trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9',
                            onTrailingClick: () => {
                                if (this.showSearch) {
                                    this.closeSearch();
                                    return;
                                }
                                this.openSearch();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '今日推荐',
                        theme: this.theme,
                        trailingSymbol: { "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
                        trailingButtonCircular: true,
                        trailingSymbolSize: 22,
                        trailingSymbolColor: this.theme.isDark ? '#E6EDF7' : '#1F2937',
                        trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9'
                    });
                }
            }, { name: "PageHeader" });
        }
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new ContentModeRail(this, {
                        mode: this.mode,
                        theme: this.theme,
                        onChange: (mode: SubscriptionMode) => {
                            this.requestModeSwitch(mode);
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 827, col: 9 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            mode: this.mode,
                            theme: this.theme,
                            onChange: (mode: SubscriptionMode) => {
                                this.requestModeSwitch(mode);
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        mode: this.mode,
                        theme: this.theme
                    });
                }
            }, { name: "ContentModeRail" });
        }
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Refresh.create({ refreshing: { value: this.isRefreshing, changeEvent: newValue => { this.isRefreshing = newValue; } } });
            Refresh.width('100%');
            Refresh.layoutWeight(1);
            Refresh.onRefreshing(() => {
                if (!this.isRefreshing) {
                    void this.refreshFeaturedEntries();
                }
            });
        }, Refresh);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.height('100%');
            Gesture.create(GesturePriority.Low);
            PanGesture.create({ direction: PanDirection.Horizontal });
            PanGesture.onActionEnd((event: GestureEvent) => {
                this.handleModeSwipe(event);
            });
            PanGesture.pop();
            Gesture.pop();
        }, Stack);
        this.ModeEntriesScene.bind(this)('articles');
        this.ModeEntriesScene.bind(this)('social');
        this.ModeEntriesScene.bind(this)('pictures');
        this.ModeEntriesScene.bind(this)('videos');
        Stack.pop();
        Refresh.pop();
        Column.pop();
    }
    onPageShow(): void {
        this.syncRequestedRootTab();
    }
    private shouldHideBottomTabs(): boolean {
        return ((this.activeRootTabId === 'discover' && this.discoverHasForegroundOverlay)
            || (this.activeRootTabId === 'subscriptions' && this.subscriptionsOverlayLevel > 0)
            || (this.activeRootTabId === 'settings' && this.settingsOverlayLevel > 0));
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.height('100%');
            Stack.padding({ top: this.topAvoidArea });
            Stack.backgroundColor(this.theme.background);
        }, Stack);
        this.RootScene.bind(this)('home');
        this.RootScene.bind(this)('subscriptions');
        this.RootScene.bind(this)('discover');
        this.RootScene.bind(this)('settings');
        Stack.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            Context.animation({ duration: 90, curve: Curve.EaseOut });
            __Common__.visibility(this.shouldHideBottomTabs() ? Visibility.Hidden : Visibility.Visible);
            __Common__.opacity(this.shouldHideBottomTabs() ? 0 : 1);
            Context.animation(null);
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new BottomTabs(this, {
                        activeTab: this.highlightedRootTabId,
                        theme: this.theme,
                        useTabsController: true,
                        onTabRequest: (tabId: RootTabId) => {
                            this.requestRootTabSwitch(tabId);
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Index.ets", line: 892, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            activeTab: this.highlightedRootTabId,
                            theme: this.theme,
                            useTabsController: true,
                            onTabRequest: (tabId: RootTabId) => {
                                this.requestRootTabSwitch(tabId);
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        activeTab: this.highlightedRootTabId,
                        theme: this.theme,
                        useTabsController: true
                    });
                }
            }, { name: "BottomTabs" });
        }
        __Common__.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showSearch) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.height('100%');
                        Column.padding({ top: this.topAvoidArea });
                        Column.justifyContent(FlexAlign.Start);
                        Column.alignItems(HorizontalAlign.Center);
                        Column.backgroundColor('rgba(0,0,0,0.15)');
                        Column.onClick(() => {
                            this.closeSearch();
                        });
                        Column.zIndex(10);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING });
                        Column.transition(TransitionEffect.asymmetric(TransitionEffect.translate({ y: -20 })
                            .combine(TransitionEffect.opacity(0))
                            .animation({ duration: 260, curve: Curve.EaseOut }), TransitionEffect.translate({ y: -20 })
                            .combine(TransitionEffect.opacity(0))
                            .animation({ duration: 260, curve: Curve.EaseIn })));
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                        Row.width('100%');
                        Row.padding({ left: 16, right: 16, top: 14, bottom: 14 });
                        Row.backgroundColor(this.theme.elevated);
                        Row.borderRadius(INPUT_RADIUS);
                        Row.border({ width: 0.8, color: this.theme.divider });
                        Row.shadow({
                            radius: 10,
                            color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
                            offsetY: 2,
                        });
                        Gesture.create(GesturePriority.Low);
                        PanGesture.create({ direction: PanDirection.Down });
                        PanGesture.onActionEnd((event: GestureEvent) => {
                            if (event.offsetY > 30) {
                                this.closeSearch();
                            }
                        });
                        PanGesture.pop();
                        Gesture.pop();
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        SymbolGlyph.create({ "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        SymbolGlyph.fontSize(20);
                        SymbolGlyph.fontColor([this.theme.textSecondary]);
                    }, SymbolGlyph);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        TextInput.create({ text: this.searchQuery, placeholder: '搜索标题、摘要或来源', controller: this.searchInputController });
                        TextInput.backgroundColor('transparent');
                        TextInput.fontColor(this.theme.textPrimary);
                        TextInput.padding(0);
                        TextInput.layoutWeight(1);
                        TextInput.defaultFocus(true);
                        TextInput.id('home_search_input');
                        TextInput.textAlign(TextAlign.Center);
                        TextInput.onChange((value: string) => {
                            this.searchQuery = value;
                        });
                        TextInput.onClick(() => {
                            if (this.searchExpanded) {
                                this.animateWithUiContext({ duration: 300, curve: Curve.EaseOut }, () => {
                                    this.searchExpanded = false;
                                });
                            }
                        });
                        TextInput.onBlur(() => {
                            if (!this.searchExpanded && this.searchQuery.trim()) {
                                this.animateWithUiContext({ duration: 300, curve: Curve.EaseOut }, () => {
                                    this.searchExpanded = true;
                                });
                            }
                        });
                    }, TextInput);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.searchQuery.trim()) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Stack.create({ alignContent: Alignment.Bottom });
                                    Context.animation({ duration: 400, curve: Curve.FastOutSlowIn });
                                    Stack.clip(true);
                                    Context.animation(null);
                                }, Stack);
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    List.create({ space: 8 });
                                    List.width('100%');
                                    List.height(this.searchPanelHeight());
                                    List.backgroundColor(this.theme.surface);
                                    List.borderRadius(this.searchExpanded ? 16 : INPUT_RADIUS);
                                    List.border({ width: 0.8, color: this.theme.divider });
                                    List.shadow({
                                        radius: 10,
                                        color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)',
                                        offsetY: 2,
                                    });
                                    List.padding({ left: 8, right: 8, top: 8, bottom: 8 });
                                    List.scrollBar(BarState.Off);
                                    List.edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true });
                                    List.alignListItem(ListItemAlign.Start);
                                    List.onWillScroll((_scrollOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
                                        if (!this.searchExpanded) {
                                            this.searchInputController.stopEditing();
                                            this.animateWithUiContext({ duration: 400, curve: Curve.FastOutSlowIn }, () => {
                                                this.searchExpanded = true;
                                            });
                                        }
                                    });
                                }, List);
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
                                                ListItem.transition(TransitionEffect.OPACITY.animation({ duration: 200, curve: Curve.EaseOut, delay: index * 30 }));
                                            };
                                            const deepRenderFunction = (elmtId, isInitialRender) => {
                                                itemCreation(elmtId, isInitialRender);
                                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                    Column.create({ space: 6 });
                                                    Column.width('100%');
                                                    Column.alignItems(HorizontalAlign.Start);
                                                    Column.padding({ left: 16, right: 16, top: 10, bottom: 10 });
                                                    Column.backgroundColor(this.theme.surface);
                                                    Column.borderRadius(12);
                                                    Column.clickEffect({ level: ClickEffectLevel.LIGHT });
                                                    Column.onClick(() => {
                                                        this.closeSearch();
                                                        this.openEntry(entry.id);
                                                    });
                                                }, Column);
                                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                    Flex.create({ justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Start });
                                                    Flex.width('100%');
                                                }, Flex);
                                                this.HighlightTitle.bind(this)(entry.title, this.searchQuery.trim());
                                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                    Text.create(entry.feedTitle);
                                                    Text.fontSize(11);
                                                    Text.fontColor(this.theme.textMuted);
                                                    Text.maxLines(1);
                                                    Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                                                    Text.flexShrink(0);
                                                    Text.margin({ left: 8, top: 2 });
                                                }, Text);
                                                Text.pop();
                                                Flex.pop();
                                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                    If.create();
                                                    if (entry.summary && entry.summary.trim()) {
                                                        this.ifElseBranchUpdateFunction(0, () => {
                                                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                                If.create();
                                                                if (this.getMatchedContent(entry.summary, this.searchQuery.trim())) {
                                                                    this.ifElseBranchUpdateFunction(0, () => {
                                                                        this.HighlightSummary.bind(this)(entry.summary, this.searchQuery.trim());
                                                                    });
                                                                }
                                                                else {
                                                                    this.ifElseBranchUpdateFunction(1, () => {
                                                                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                                            Text.create(entry.summary);
                                                                            Text.fontSize(12);
                                                                            Text.fontColor(this.theme.textSecondary);
                                                                            Text.maxLines(2);
                                                                            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                                                                            Text.width('100%');
                                                                        }, Text);
                                                                        Text.pop();
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
                                    };
                                    this.forEachUpdateFunction(elmtId, this.searchAllEntries(), forEachItemGenFunction, (entry: EntryCardModel) => `${entry.id}_${this.searchQuery}`, true, false);
                                }, ForEach);
                                ForEach.pop();
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    If.create();
                                    if (this.hasSearchEmptyState()) {
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
                                                        Column.create({ space: 8 });
                                                        Column.width('100%');
                                                        Column.padding({ left: 20, right: 20, top: 24, bottom: 24 });
                                                        Column.justifyContent(FlexAlign.Center);
                                                        Column.alignItems(HorizontalAlign.Center);
                                                        Column.backgroundColor(this.theme.surface);
                                                        Column.borderRadius(12);
                                                    }, Column);
                                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                        SymbolGlyph.create({ "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                                                        SymbolGlyph.fontSize(24);
                                                        SymbolGlyph.fontColor([this.theme.textMuted]);
                                                    }, SymbolGlyph);
                                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                        Text.create('搜索不到内容');
                                                        Text.fontSize(15);
                                                        Text.fontWeight(FontWeight.Medium);
                                                        Text.fontColor(this.theme.textPrimary);
                                                    }, Text);
                                                    Text.pop();
                                                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                                                        Text.create('换个关键词试试，或者搜索标题、摘要和来源');
                                                        Text.fontSize(12);
                                                        Text.fontColor(this.theme.textSecondary);
                                                        Text.textAlign(TextAlign.Center);
                                                        Text.maxLines(2);
                                                    }, Text);
                                                    Text.pop();
                                                    Column.pop();
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
                                List.pop();
                                Stack.pop();
                            });
                        }
                        else {
                            this.ifElseBranchUpdateFunction(1, () => {
                            });
                        }
                    }, If);
                    If.pop();
                    Column.pop();
                    Column.pop();
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
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Index";
    }
}
registerNamedRoute(() => new Index(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Index", pageFullPath: "entry/src/main/ets/pages/Index", integratedHsp: "false", moduleType: "followWithHap" });

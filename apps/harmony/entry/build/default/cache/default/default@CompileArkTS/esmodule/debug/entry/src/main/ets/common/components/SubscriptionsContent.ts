if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface SubscriptionsContent_Params {
    feeds?: FeedCardModel[];
    mode?: SubscriptionMode;
    renderedMode?: SubscriptionMode;
    previousMode?: SubscriptionMode;
    isModeTransitioning?: boolean;
    modeTransitionDirection?: number;
    theme?: ThemePalette;
    sourceHint?: string;
    hasLoaded?: boolean;
    isLoading?: boolean;
    overlayLevel?: number;
    subscriptionsOverlayLevel?: number;
    feedsChangedAt?: number;
    showBottomTabs?: boolean;
    inheritedTheme?: ThemePalette;
    subscriptionPathStack?: NavPathStack;
    onReady?: () => void;
    modeTransitionVersion?: number;
}
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { AvatarTile } from "@bundle:com.livo.harmony/entry/ets/common/components/AvatarTile";
import { BottomTabs } from "@bundle:com.livo.harmony/entry/ets/common/components/BottomTabs";
import { openArticleDetail } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { ContentModeRail } from "@bundle:com.livo.harmony/entry/ets/common/components/ContentModeRail";
import { FeedDetailView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedDetailView";
import { FeedSubscribeConfigView } from "@bundle:com.livo.harmony/entry/ets/common/components/FeedSubscribeConfigView";
import { PageHeader } from "@bundle:com.livo.harmony/entry/ets/common/components/PageHeader";
import { FeedViewType, toArticleDetailModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry, Feed, FeedCardModel } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { FeedRefreshPayload } from '../services/RssFeedService';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { CARD_RADIUS_LG, CARD_RADIUS_MD, META_FONT_SIZE, PAGE_BOTTOM_GAP, LIST_ROW_DIVIDER_INSET, LIST_ROW_HORIZONTAL_PADDING, LIST_ROW_TITLE_SIZE, LIST_ROW_VERTICAL_PADDING, PAGE_HORIZONTAL_PADDING, PAGE_TOP_PADDING, } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos';
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos'];
const MODE_SCENE_DURATION: number = 240;
const MODE_SWIPE_TRIGGER_OFFSET: number = 56;
const SUBSCRIPTIONS_ROUTE_FEED_DETAIL: string = 'subscriptions-feed-detail';
const SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG: string = 'subscriptions-subscribe-config';
class SubscriptionFeedDetailParams {
    feedId: string = '';
}
class SubscriptionFeedConfigParams {
    targetUrl: string = '';
    targetTitle: string = '';
    targetSiteUrl: string = '';
    targetImageUrl: string = '';
    targetDescription: string = '';
    targetCategory: string = '';
    sourceKind: string = '';
    initialSelectedView: FeedViewType = FeedViewType.Articles;
}
export class SubscriptionsContent extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__feeds = new ObservedPropertyObjectPU([], this, "feeds");
        this.__mode = new ObservedPropertySimplePU('articles', this, "mode");
        this.__renderedMode = new ObservedPropertySimplePU('articles', this, "renderedMode");
        this.__previousMode = new ObservedPropertySimplePU('articles', this, "previousMode");
        this.__isModeTransitioning = new ObservedPropertySimplePU(false, this, "isModeTransitioning");
        this.__modeTransitionDirection = new ObservedPropertySimplePU(1, this, "modeTransitionDirection");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__sourceHint = new ObservedPropertySimplePU('正在加载订阅内容...', this, "sourceHint");
        this.__hasLoaded = new ObservedPropertySimplePU(false, this, "hasLoaded");
        this.__isLoading = new ObservedPropertySimplePU(false, this, "isLoading");
        this.__overlayLevel = new ObservedPropertySimplePU(0, this, "overlayLevel");
        this.__subscriptionsOverlayLevel = this.createStorageProp('subscriptionsOverlayLevel', 0, "subscriptionsOverlayLevel");
        this.__feedsChangedAt = this.createStorageProp('feedsChangedAt', 0, "feedsChangedAt");
        this.__showBottomTabs = new SynchedPropertySimpleOneWayPU(params.showBottomTabs, this, "showBottomTabs");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.subscriptionPathStack = new NavPathStack();
        this.onReady = () => { };
        this.modeTransitionVersion = 0;
        this.setInitiallyProvidedValue(params);
        this.declareWatch("feedsChangedAt", this.handleFeedsChanged);
        this.declareWatch("inheritedTheme", this.syncInheritedTheme);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: SubscriptionsContent_Params) {
        if (params.feeds !== undefined) {
            this.feeds = params.feeds;
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
        if (params.sourceHint !== undefined) {
            this.sourceHint = params.sourceHint;
        }
        if (params.hasLoaded !== undefined) {
            this.hasLoaded = params.hasLoaded;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
        if (params.overlayLevel !== undefined) {
            this.overlayLevel = params.overlayLevel;
        }
        if (params.showBottomTabs === undefined) {
            this.__showBottomTabs.set(true);
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
        if (params.subscriptionPathStack !== undefined) {
            this.subscriptionPathStack = params.subscriptionPathStack;
        }
        if (params.onReady !== undefined) {
            this.onReady = params.onReady;
        }
        if (params.modeTransitionVersion !== undefined) {
            this.modeTransitionVersion = params.modeTransitionVersion;
        }
    }
    updateStateVars(params: SubscriptionsContent_Params) {
        this.__showBottomTabs.reset(params.showBottomTabs);
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__feeds.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__renderedMode.purgeDependencyOnElmtId(rmElmtId);
        this.__previousMode.purgeDependencyOnElmtId(rmElmtId);
        this.__isModeTransitioning.purgeDependencyOnElmtId(rmElmtId);
        this.__modeTransitionDirection.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__sourceHint.purgeDependencyOnElmtId(rmElmtId);
        this.__hasLoaded.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
        this.__overlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__subscriptionsOverlayLevel.purgeDependencyOnElmtId(rmElmtId);
        this.__feedsChangedAt.purgeDependencyOnElmtId(rmElmtId);
        this.__showBottomTabs.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__feeds.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
        this.__renderedMode.aboutToBeDeleted();
        this.__previousMode.aboutToBeDeleted();
        this.__isModeTransitioning.aboutToBeDeleted();
        this.__modeTransitionDirection.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__sourceHint.aboutToBeDeleted();
        this.__hasLoaded.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
        this.__overlayLevel.aboutToBeDeleted();
        this.__subscriptionsOverlayLevel.aboutToBeDeleted();
        this.__feedsChangedAt.aboutToBeDeleted();
        this.__showBottomTabs.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __feeds: ObservedPropertyObjectPU<FeedCardModel[]>;
    get feeds() {
        return this.__feeds.get();
    }
    set feeds(newValue: FeedCardModel[]) {
        this.__feeds.set(newValue);
    }
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
    private __sourceHint: ObservedPropertySimplePU<string>;
    get sourceHint() {
        return this.__sourceHint.get();
    }
    set sourceHint(newValue: string) {
        this.__sourceHint.set(newValue);
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
    private __overlayLevel: ObservedPropertySimplePU<number>;
    get overlayLevel() {
        return this.__overlayLevel.get();
    }
    set overlayLevel(newValue: number) {
        this.__overlayLevel.set(newValue);
    }
    private __subscriptionsOverlayLevel: ObservedPropertyAbstractPU<number>;
    get subscriptionsOverlayLevel() {
        return this.__subscriptionsOverlayLevel.get();
    }
    set subscriptionsOverlayLevel(newValue: number) {
        this.__subscriptionsOverlayLevel.set(newValue);
    }
    private __feedsChangedAt: ObservedPropertyAbstractPU<number>;
    get feedsChangedAt() {
        return this.__feedsChangedAt.get();
    }
    set feedsChangedAt(newValue: number) {
        this.__feedsChangedAt.set(newValue);
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
    private subscriptionPathStack: NavPathStack;
    private onReady: () => void;
    private modeTransitionVersion: number;
    private syncOverlayLevel(level: number): void {
        this.overlayLevel = level;
        AppStorage.setOrCreate('subscriptionsOverlayLevel', level);
    }
    private settleSubscriptionsRootVisible(): void {
        this.syncOverlayLevel(0);
    }
    aboutToAppear(): void {
        this.overlayLevel = this.subscriptionsOverlayLevel;
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
            if (this.hasLoaded || this.isLoading) {
                this.onReady();
                return;
            }
        }
        void this.loadPageData();
    }
    private async loadPageData(): Promise<void> {
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        try {
            if (this.showBottomTabs) {
                const settings = await AppRepository.settings();
                this.theme = await ThemeService.resolvePalette(settings);
            }
            else {
                this.theme = this.inheritedTheme;
            }
            this.feeds = await AppRepository.feeds();
            this.sourceHint = '已加载本地订阅内容';
            this.hasLoaded = true;
            this.onReady();
        }
        finally {
            this.isLoading = false;
        }
    }
    private async refreshFeeds(): Promise<void> {
        this.feeds = await AppRepository.feeds();
        this.sourceHint = '已加载本地订阅内容';
        this.hasLoaded = true;
    }
    private syncInheritedTheme(): void {
        if (!this.showBottomTabs) {
            this.theme = this.inheritedTheme;
        }
    }
    private handleFeedsChanged(): void {
        void this.refreshFeeds();
    }
    private headerTitle(mode: SubscriptionMode = this.mode): string {
        switch (mode) {
            case 'social':
                return '社交';
            case 'pictures':
                return '图片';
            case 'videos':
                return '视频';
            default:
                return '文章';
        }
    }
    private modeLabel(mode: SubscriptionMode = this.mode): string {
        return this.headerTitle(mode);
    }
    private filteredFeedsFor(mode: SubscriptionMode): FeedCardModel[] {
        return this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === this.modeLabel(mode));
    }
    private filteredFeeds(): FeedCardModel[] {
        return this.filteredFeedsFor(this.mode);
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
    private deriveFallbackIcon(siteUrl: string): string {
        const trimmed = siteUrl.trim();
        if (!trimmed) {
            return '';
        }
        try {
            const protocolMatch = trimmed.match(/^(https?:)/);
            const protocol = protocolMatch ? protocolMatch[1] : 'https:';
            const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
            const host = withoutProtocol.split('/')[0];
            return `${protocol}//${host}/favicon.ico`;
        }
        catch (_) {
            return '';
        }
    }
    private iconSource(feed: FeedCardModel | undefined): string {
        if (!feed) {
            return '';
        }
        if (feed.imageUrl.trim().length > 0) {
            return feed.imageUrl.trim();
        }
        return this.deriveFallbackIcon(feed.siteUrl);
    }
    private FeedAvatar(feed: FeedCardModel | undefined, parent = null) {
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new AvatarTile(this, {
                        imageUrl: this.iconSource(feed),
                        fallbackLabel: feed ? feed.title : 'Livo',
                        accent: this.theme.elevated,
                        theme: this.theme,
                        avatarSize: 22,
                        radius: 6,
                        textSize: 11,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 296, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            imageUrl: this.iconSource(feed),
                            fallbackLabel: feed ? feed.title : 'Livo',
                            accent: this.theme.elevated,
                            theme: this.theme,
                            avatarSize: 22,
                            radius: 6,
                            textSize: 11
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        imageUrl: this.iconSource(feed),
                        fallbackLabel: feed ? feed.title : 'Livo',
                        accent: this.theme.elevated,
                        theme: this.theme,
                        avatarSize: 22,
                        radius: 6,
                        textSize: 11
                    });
                }
            }, { name: "AvatarTile" });
        }
    }
    private FeedRow(feed: FeedCardModel, index: number, showDivider: boolean, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.transition(livoMotion.enterScale(index * 18 + 30));
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 12 });
            Row.width('100%');
            Row.height(62);
            Row.padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING });
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.onClick(() => {
                this.openFeedDetailPage(feed.id);
            });
        }, Row);
        this.FeedAvatar.bind(this)(feed);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 4 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(feed.title);
            Text.fontSize(LIST_ROW_TITLE_SIZE);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(feed.siteUrl.replace(/^https?:\/\//, ''));
            Text.fontSize(META_FONT_SIZE);
            Text.fontColor(this.theme.textSecondary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width(4);
            Row.height(4);
            Row.borderRadius(999);
            Row.backgroundColor(this.theme.textMuted);
        }, Row);
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (showDivider) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Divider.create();
                        Divider.strokeWidth(1);
                        Divider.color(this.theme.divider);
                        Divider.margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET });
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
    private FeedSection(mode: SubscriptionMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 14 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
            Column.justifyContent(FlexAlign.Start);
            Column.constraintSize({ minHeight: '100%' });
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: PAGE_BOTTOM_GAP });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('订阅源');
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textMuted);
            Text.padding({ left: 4 });
            Text.width('100%');
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.filteredFeedsFor(mode).length === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding(18);
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_MD);
                        Column.border({ width: 0.8, color: this.theme.divider });
                        Column.transition(livoMotion.enterScale(70));
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`您还没有收藏任何${this.headerTitle(mode)}源`);
                        Text.fontSize(18);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('先添加对应类型的订阅源，或者刷新现有订阅后再回来看看。');
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
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.backgroundColor(this.theme.surface);
                        Column.borderRadius(CARD_RADIUS_LG);
                        Column.border({ width: 0.8, color: this.theme.divider });
                        Column.clip(true);
                        Column.transition(livoMotion.enterScale(70));
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const feed = _item;
                            this.FeedRow.bind(this)(feed, index, index < this.filteredFeedsFor(mode).length - 1);
                        };
                        this.forEachUpdateFunction(elmtId, this.filteredFeedsFor(mode), forEachItemGenFunction, (feed: FeedCardModel) => feed.id, true, false);
                    }, ForEach);
                    ForEach.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.height(88);
            Row.width('100%');
        }, Row);
        Row.pop();
        Column.pop();
    }
    private ModeFeedsScene(mode: SubscriptionMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Scroll.create();
            Context.animation({
                duration: MODE_SCENE_DURATION,
                curve: Curve.EaseInOut,
            });
            Scroll.width('100%');
            Scroll.height('100%');
            Scroll.nestedScroll({
                scrollForward: NestedScrollMode.SELF_FIRST,
                scrollBackward: NestedScrollMode.SELF_FIRST,
            });
            Scroll.scrollBar(BarState.Off);
            Scroll.edgeEffect(EdgeEffect.Spring);
            Scroll.visibility(this.modeSceneVisible(mode));
            Scroll.opacity(this.modeSceneOpacity(mode));
            Scroll.translate({ x: this.modeSceneOffset(mode) });
            Scroll.zIndex(this.modeSceneZIndex(mode));
            Context.animation(null);
        }, Scroll);
        this.FeedSection.bind(this)(mode);
        Scroll.pop();
    }
    private openFeedDetailPage(feedId: string): void {
        const params = new SubscriptionFeedDetailParams();
        params.feedId = feedId;
        this.syncOverlayLevel(1);
        this.subscriptionPathStack.pushPathByName(SUBSCRIPTIONS_ROUTE_FEED_DETAIL, params, true);
    }
    private closeFeedDetailPage(): void {
        this.syncOverlayLevel(0);
        this.subscriptionPathStack.pop(true);
    }
    private createFeedConfigParams(feed: Feed): SubscriptionFeedConfigParams {
        const params = new SubscriptionFeedConfigParams();
        params.targetUrl = feed.url;
        params.targetTitle = feed.title;
        params.targetSiteUrl = feed.siteUrl || '';
        params.targetImageUrl = feed.imageUrl || '';
        params.targetDescription = feed.description || '';
        params.targetCategory = feed.category || '';
        params.sourceKind = '编辑';
        params.initialSelectedView = feed.view as FeedViewType;
        return params;
    }
    private openEditPage(feed: Feed): void {
        this.syncOverlayLevel(2);
        this.subscriptionPathStack.pushPathByName(SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG, this.createFeedConfigParams(feed), true);
    }
    private openEntryDetail(entry: Entry, feed: Feed): void {
        const model = toArticleDetailModel(entry, feed);
        void openArticleDetail(entry.id || feed.id || 'entry', JSON.stringify(model));
    }
    private FeedDetailDestination(params?: SubscriptionFeedDetailParams, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.onAppear(() => {
                this.syncOverlayLevel(1);
            });
            __Common__.onDisAppear(() => {
                const currentLevel = AppStorage.get<number>('subscriptionsOverlayLevel') ?? 0;
                if (currentLevel <= 1) {
                    this.syncOverlayLevel(0);
                }
            });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new FeedDetailView(this, {
                        feedId: params?.feedId ?? '',
                        theme: this.theme,
                        onBack: () => { this.closeFeedDetailPage(); },
                        onEdit: (feed: Feed) => { this.openEditPage(feed); },
                        onSubscribe: (_payload: FeedRefreshPayload) => { },
                        onOpenArticle: (entry: Entry, feed: Feed) => { this.openEntryDetail(entry, feed); },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 475, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            feedId: params?.feedId ?? '',
                            theme: this.theme,
                            onBack: () => { this.closeFeedDetailPage(); },
                            onEdit: (feed: Feed) => { this.openEditPage(feed); },
                            onSubscribe: (_payload: FeedRefreshPayload) => { },
                            onOpenArticle: (entry: Entry, feed: Feed) => { this.openEntryDetail(entry, feed); }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        feedId: params?.feedId ?? '',
                        theme: this.theme
                    });
                }
            }, { name: "FeedDetailView" });
        }
        __Common__.pop();
    }
    private FeedSubscribeConfigDestination(params?: SubscriptionFeedConfigParams, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            __Common__.create();
            __Common__.onAppear(() => {
                this.syncOverlayLevel(2);
            });
            __Common__.onDisAppear(() => {
                const currentLevel = AppStorage.get<number>('subscriptionsOverlayLevel') ?? 0;
                if (currentLevel > 1) {
                    this.syncOverlayLevel(1);
                }
                else {
                    this.syncOverlayLevel(currentLevel);
                }
            });
        }, __Common__);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new FeedSubscribeConfigView(this, {
                        targetUrl: params?.targetUrl ?? '',
                        targetTitle: params?.targetTitle ?? '',
                        targetSiteUrl: params?.targetSiteUrl ?? '',
                        targetImageUrl: params?.targetImageUrl ?? '',
                        targetDescription: params?.targetDescription ?? '',
                        targetCategory: params?.targetCategory ?? '',
                        sourceKind: params?.sourceKind ?? '',
                        initialSelectedView: params?.initialSelectedView ?? FeedViewType.Articles,
                        theme: this.theme,
                        onBack: () => {
                            this.syncOverlayLevel(1);
                            this.subscriptionPathStack.pop(true);
                        },
                        onSubscribed: async () => {
                            await this.refreshFeeds();
                            this.syncOverlayLevel(0);
                            this.subscriptionPathStack.clear();
                        },
                        onSaved: async () => {
                            await this.refreshFeeds();
                            this.syncOverlayLevel(1);
                            this.subscriptionPathStack.pop(true);
                        },
                        onUnsubscribed: async () => {
                            await this.refreshFeeds();
                            this.syncOverlayLevel(0);
                            this.subscriptionPathStack.clear();
                        },
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 496, col: 5 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            targetUrl: params?.targetUrl ?? '',
                            targetTitle: params?.targetTitle ?? '',
                            targetSiteUrl: params?.targetSiteUrl ?? '',
                            targetImageUrl: params?.targetImageUrl ?? '',
                            targetDescription: params?.targetDescription ?? '',
                            targetCategory: params?.targetCategory ?? '',
                            sourceKind: params?.sourceKind ?? '',
                            initialSelectedView: params?.initialSelectedView ?? FeedViewType.Articles,
                            theme: this.theme,
                            onBack: () => {
                                this.syncOverlayLevel(1);
                                this.subscriptionPathStack.pop(true);
                            },
                            onSubscribed: async () => {
                                await this.refreshFeeds();
                                this.syncOverlayLevel(0);
                                this.subscriptionPathStack.clear();
                            },
                            onSaved: async () => {
                                await this.refreshFeeds();
                                this.syncOverlayLevel(1);
                                this.subscriptionPathStack.pop(true);
                            },
                            onUnsubscribed: async () => {
                                await this.refreshFeeds();
                                this.syncOverlayLevel(0);
                                this.subscriptionPathStack.clear();
                            }
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        targetUrl: params?.targetUrl ?? '',
                        targetTitle: params?.targetTitle ?? '',
                        targetSiteUrl: params?.targetSiteUrl ?? '',
                        targetImageUrl: params?.targetImageUrl ?? '',
                        targetDescription: params?.targetDescription ?? '',
                        targetCategory: params?.targetCategory ?? '',
                        sourceKind: params?.sourceKind ?? '',
                        initialSelectedView: params?.initialSelectedView ?? FeedViewType.Articles,
                        theme: this.theme
                    });
                }
            }, { name: "FeedSubscribeConfigView" });
        }
        __Common__.pop();
    }
    private Destinations(name: string, params?: SubscriptionFeedDetailParams | SubscriptionFeedConfigParams, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (name === SUBSCRIPTIONS_ROUTE_FEED_DETAIL) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        NavDestination.create(() => {
                            this.FeedDetailDestination.bind(this)(params as SubscriptionFeedDetailParams);
                        }, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/SubscriptionsContent" });
                        NavDestination.hideTitleBar(true);
                    }, NavDestination);
                    NavDestination.pop();
                });
            }
            else if (name === SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        NavDestination.create(() => {
                            this.FeedSubscribeConfigDestination.bind(this)(params as SubscriptionFeedConfigParams);
                        }, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/SubscriptionsContent" });
                        NavDestination.hideTitleBar(true);
                    }, NavDestination);
                    NavDestination.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
    }
    private SubscriptionsRoot(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Bottom });
            Stack.width('100%');
            Stack.height('100%');
            Stack.backgroundColor(this.theme.background);
            Stack.onAppear(() => {
                this.settleSubscriptionsRootVisible();
            });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
            Column.padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: PAGE_TOP_PADDING, bottom: 6 });
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new PageHeader(this, {
                        title: '订阅库',
                        theme: this.theme,
                        trailingSymbol: { "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
                        trailingButtonCircular: true,
                        trailingSymbolSize: 22,
                        trailingSymbolColor: this.theme.isDark ? '#E6EDF7' : '#1F2937',
                        trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9',
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 559, col: 11 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            title: '订阅库',
                            theme: this.theme,
                            trailingSymbol: { "id": 125831500, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" },
                            trailingButtonCircular: true,
                            trailingSymbolSize: 22,
                            trailingSymbolColor: this.theme.isDark ? '#E6EDF7' : '#1F2937',
                            trailingButtonBackground: this.theme.isDark ? '#242A33' : '#E6E8E9'
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        title: '订阅库',
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
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 569, col: 11 });
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
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.padding({ left: 4, right: 4 });
            Row.transition(livoMotion.enterRise(50));
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.sourceHint);
            Text.fontSize(META_FONT_SIZE);
            Text.fontColor(this.theme.textSecondary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Blank.create();
        }, Blank);
        Blank.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(`${this.filteredFeeds().length} 个订阅源`);
            Text.fontSize(META_FONT_SIZE);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.layoutWeight(1);
            Stack.backgroundColor(this.theme.background);
            Gesture.create(GesturePriority.Low);
            PanGesture.create({ direction: PanDirection.Horizontal });
            PanGesture.onActionEnd((event: GestureEvent) => {
                this.handleModeSwipe(event);
            });
            PanGesture.pop();
            Gesture.pop();
        }, Stack);
        this.ModeFeedsScene.bind(this)('articles');
        this.ModeFeedsScene.bind(this)('social');
        this.ModeFeedsScene.bind(this)('pictures');
        this.ModeFeedsScene.bind(this)('videos');
        Stack.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showBottomTabs && this.overlayLevel === 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        __Common__.create();
                        __Common__.align(Alignment.Bottom);
                    }, __Common__);
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new BottomTabs(this, { activeTab: 'subscriptions', theme: this.theme }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/SubscriptionsContent.ets", line: 617, col: 9 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        activeTab: 'subscriptions',
                                        theme: this.theme
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    activeTab: 'subscriptions', theme: this.theme
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
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Navigation.create(this.subscriptionPathStack, { moduleName: "entry", pagePath: "entry/src/main/ets/common/components/SubscriptionsContent", isUserCreateStack: true });
            Navigation.hideToolBar(true);
            Navigation.hideBackButton(true);
            Navigation.mode(NavigationMode.Stack);
            Navigation.navDestination({ builder: this.Destinations.bind(this) });
            Navigation.width('100%');
            Navigation.height('100%');
            Navigation.backgroundColor(this.theme.background);
        }, Navigation);
        this.SubscriptionsRoot.bind(this)();
        Navigation.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

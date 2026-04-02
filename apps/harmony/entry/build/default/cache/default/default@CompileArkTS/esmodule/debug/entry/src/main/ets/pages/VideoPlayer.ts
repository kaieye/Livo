if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface VideoPlayer_Params {
    topAvoidArea?: number;
    bottomAvoidArea?: number;
    title?: string;
    videoUrl?: string;
    previewUrl?: string;
    playableUrl?: string;
    fallbackUrl?: string;
    mode?: VideoPlayerLaunchMode;
    actionHint?: string;
    theme?: ThemePalette;
    previousOrientation?: window.Orientation;
    nativeVideoController?: VideoController;
    webController?: webview.WebviewController;
    webVideoUserAgent?: string;
}
import window from "@ohos:window";
import webview from "@ohos:web.webview";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { getStringParams, goBack } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
import { VideoResolverService } from "@bundle:com.livo.harmony/entry/ets/common/services/VideoResolverService";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { resolveVideoPlayerLaunchState } from "@bundle:com.livo.harmony/entry/ets/common/utils/VideoPlayerLaunchState";
import type { VideoPlayerLaunchMode } from "@bundle:com.livo.harmony/entry/ets/common/utils/VideoPlayerLaunchState";
class VideoPlayer extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__topAvoidArea = this.createStorageProp('topAvoidArea', 0, "topAvoidArea");
        this.__bottomAvoidArea = this.createStorageProp('bottomAvoidArea', 0, "bottomAvoidArea");
        this.__title = new ObservedPropertySimplePU('视频播放', this, "title");
        this.__videoUrl = new ObservedPropertySimplePU('', this, "videoUrl");
        this.__previewUrl = new ObservedPropertySimplePU('', this, "previewUrl");
        this.__playableUrl = new ObservedPropertySimplePU('', this, "playableUrl");
        this.__fallbackUrl = new ObservedPropertySimplePU('', this, "fallbackUrl");
        this.__mode = new ObservedPropertySimplePU('error', this, "mode");
        this.__actionHint = new ObservedPropertySimplePU('', this, "actionHint");
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.previousOrientation = undefined;
        this.nativeVideoController = new VideoController();
        this.webController = new webview.WebviewController();
        this.webVideoUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: VideoPlayer_Params) {
        if (params.title !== undefined) {
            this.title = params.title;
        }
        if (params.videoUrl !== undefined) {
            this.videoUrl = params.videoUrl;
        }
        if (params.previewUrl !== undefined) {
            this.previewUrl = params.previewUrl;
        }
        if (params.playableUrl !== undefined) {
            this.playableUrl = params.playableUrl;
        }
        if (params.fallbackUrl !== undefined) {
            this.fallbackUrl = params.fallbackUrl;
        }
        if (params.mode !== undefined) {
            this.mode = params.mode;
        }
        if (params.actionHint !== undefined) {
            this.actionHint = params.actionHint;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.previousOrientation !== undefined) {
            this.previousOrientation = params.previousOrientation;
        }
        if (params.nativeVideoController !== undefined) {
            this.nativeVideoController = params.nativeVideoController;
        }
        if (params.webController !== undefined) {
            this.webController = params.webController;
        }
        if (params.webVideoUserAgent !== undefined) {
            this.webVideoUserAgent = params.webVideoUserAgent;
        }
    }
    updateStateVars(params: VideoPlayer_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__topAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__bottomAvoidArea.purgeDependencyOnElmtId(rmElmtId);
        this.__title.purgeDependencyOnElmtId(rmElmtId);
        this.__videoUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__previewUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__playableUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__fallbackUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__actionHint.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__topAvoidArea.aboutToBeDeleted();
        this.__bottomAvoidArea.aboutToBeDeleted();
        this.__title.aboutToBeDeleted();
        this.__videoUrl.aboutToBeDeleted();
        this.__previewUrl.aboutToBeDeleted();
        this.__playableUrl.aboutToBeDeleted();
        this.__fallbackUrl.aboutToBeDeleted();
        this.__mode.aboutToBeDeleted();
        this.__actionHint.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
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
    private __bottomAvoidArea: ObservedPropertyAbstractPU<number>;
    get bottomAvoidArea() {
        return this.__bottomAvoidArea.get();
    }
    set bottomAvoidArea(newValue: number) {
        this.__bottomAvoidArea.set(newValue);
    }
    private __title: ObservedPropertySimplePU<string>;
    get title() {
        return this.__title.get();
    }
    set title(newValue: string) {
        this.__title.set(newValue);
    }
    private __videoUrl: ObservedPropertySimplePU<string>;
    get videoUrl() {
        return this.__videoUrl.get();
    }
    set videoUrl(newValue: string) {
        this.__videoUrl.set(newValue);
    }
    private __previewUrl: ObservedPropertySimplePU<string>;
    get previewUrl() {
        return this.__previewUrl.get();
    }
    set previewUrl(newValue: string) {
        this.__previewUrl.set(newValue);
    }
    private __playableUrl: ObservedPropertySimplePU<string>;
    get playableUrl() {
        return this.__playableUrl.get();
    }
    set playableUrl(newValue: string) {
        this.__playableUrl.set(newValue);
    }
    private __fallbackUrl: ObservedPropertySimplePU<string>;
    get fallbackUrl() {
        return this.__fallbackUrl.get();
    }
    set fallbackUrl(newValue: string) {
        this.__fallbackUrl.set(newValue);
    }
    private __mode: ObservedPropertySimplePU<VideoPlayerLaunchMode>;
    get mode() {
        return this.__mode.get();
    }
    set mode(newValue: VideoPlayerLaunchMode) {
        this.__mode.set(newValue);
    }
    private __actionHint: ObservedPropertySimplePU<string>;
    get actionHint() {
        return this.__actionHint.get();
    }
    set actionHint(newValue: string) {
        this.__actionHint.set(newValue);
    }
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private previousOrientation?: window.Orientation;
    private nativeVideoController: VideoController;
    private webController: webview.WebviewController;
    private readonly webVideoUserAgent: string;
    aboutToAppear(): void {
        const params = getStringParams();
        this.title = params.title || '视频播放';
        this.videoUrl = params.videoUrl || '';
        this.previewUrl = params.previewUrl || '';
        void this.loadTheme();
        this.initializePlayer();
        void this.applyPlayerOrientation();
    }
    aboutToDisappear(): void {
        void this.restoreOrientation();
    }
    private async loadTheme(): Promise<void> {
        const settings = await AppRepository.settings();
        this.theme = await ThemeService.resolvePalette(settings);
    }
    private initializePlayer(): void {
        if (!this.videoUrl) {
            this.mode = 'error';
            this.actionHint = '视频地址无效';
            return;
        }
        const state = resolveVideoPlayerLaunchState(this.videoUrl, VideoResolverService.buildWebFallbackUrl(this.videoUrl));
        this.mode = state.mode;
        this.playableUrl = state.playableUrl;
        this.fallbackUrl = state.fallbackUrl;
        this.actionHint = state.actionHint;
    }
    private async applyPlayerOrientation(): Promise<void> {
        const mainWindow = AppStorage.get<window.Window>('WindowClass');
        if (!mainWindow) {
            return;
        }
        try {
            this.previousOrientation = mainWindow.getPreferredOrientation();
            await mainWindow.setPreferredOrientation(window.Orientation.AUTO_ROTATION_UNSPECIFIED);
        }
        catch (error) {
            console.error(`Failed to enable landscape video orientation: ${error}`);
        }
    }
    private async restoreOrientation(): Promise<void> {
        const mainWindow = AppStorage.get<window.Window>('WindowClass');
        if (!mainWindow) {
            return;
        }
        try {
            await mainWindow.setPreferredOrientation(this.previousOrientation ?? window.Orientation.AUTO_ROTATION_PORTRAIT);
        }
        catch (error) {
            console.error(`Failed to restore app orientation: ${error}`);
        }
    }
    private PlayerBody(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.mode === 'direct' && this.playableUrl) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Video.create({
                            src: this.playableUrl,
                            controller: this.nativeVideoController,
                            previewUri: this.previewUrl,
                        });
                        Video.width('100%');
                        Video.height('100%');
                        Video.controls(true);
                        Video.autoPlay(true);
                        Video.objectFit(ImageFit.Contain);
                        Video.onError(() => {
                            this.actionHint = '应用内播放失败，请稍后重试';
                        });
                    }, Video);
                });
            }
            else if (this.mode === 'web' && this.fallbackUrl) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Web.create({
                            src: this.fallbackUrl,
                            controller: this.webController,
                        });
                        Web.width('100%');
                        Web.height('100%');
                        Web.javaScriptAccess(true);
                        Web.domStorageAccess(true);
                        Web.mixedMode(MixedMode.All);
                        Web.onControllerAttached(() => {
                            try {
                                webview.WebCookieManager.putAcceptCookieEnabled(true);
                                webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);
                                this.webController.setCustomUserAgent(this.webVideoUserAgent);
                            }
                            catch (_error) {
                            }
                        });
                        Web.onPageBegin((_event: OnPageBeginEvent) => {
                            this.actionHint = '正在加载 YouTube 播放器...';
                        });
                        Web.onPageEnd((_event: OnPageEndEvent) => {
                            this.actionHint = '';
                        });
                        Web.onErrorReceive((event: OnErrorReceiveEvent) => {
                            if (event.request?.isMainFrame()) {
                                this.actionHint = 'YouTube 播放器加载失败，请稍后重试';
                            }
                        });
                    }, Web);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 10 });
                        Column.width('100%');
                        Column.height('100%');
                        Column.justifyContent(FlexAlign.Center);
                        Column.alignItems(HorizontalAlign.Center);
                        Column.padding(24);
                        Column.backgroundColor('#000000');
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('当前视频暂时无法在应用内播放');
                        Text.fontSize(16);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor('#FFFFFF');
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.actionHint || '请稍后重试');
                        Text.fontSize(13);
                        Text.fontColor('rgba(255,255,255,0.72)');
                        Text.textAlign(TextAlign.Center);
                    }, Text);
                    Text.pop();
                    Column.pop();
                });
            }
        }, If);
        If.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.TopStart });
            Stack.width('100%');
            Stack.height('100%');
            Stack.padding({
                top: this.topAvoidArea,
                bottom: this.bottomAvoidArea,
            });
            Stack.backgroundColor('#000000');
        }, Stack);
        this.PlayerBody.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.actionHint) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.padding({ left: 16, right: 16, bottom: Math.max(24, this.bottomAvoidArea + 8) });
                        Column.alignItems(HorizontalAlign.Center);
                        Column.justifyContent(FlexAlign.End);
                        Column.align(Alignment.Bottom);
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.actionHint);
                        Text.fontSize(12);
                        Text.fontColor('#FFFFFF');
                        Text.padding({ left: 12, right: 12, top: 8, bottom: 8 });
                        Text.backgroundColor('rgba(0,0,0,0.56)');
                        Text.borderRadius(999);
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
            Row.create();
            Row.width(42);
            Row.height(42);
            Row.justifyContent(FlexAlign.Center);
            Row.alignItems(VerticalAlign.Center);
            Row.backgroundColor('rgba(0,0,0,0.48)');
            Row.borderRadius(999);
            Row.margin({ left: 16, top: 16 });
            Row.onClick(() => {
                void goBack();
            });
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create({ "id": 125833534, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(20);
            SymbolGlyph.fontColor(['#FFFFFF']);
        }, SymbolGlyph);
        Row.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "VideoPlayer";
    }
}
registerNamedRoute(() => new VideoPlayer(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/VideoPlayer", pageFullPath: "entry/src/main/ets/pages/VideoPlayer", integratedHsp: "false", moduleType: "followWithHap" });

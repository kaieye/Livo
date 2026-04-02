if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface ContentModeRail_Params {
    mode?: ContentMode;
    theme?: ThemePalette;
    pressedMode?: ContentMode | '';
    indicatorScaleX?: number;
    indicatorScaleY?: number;
    emphasizedMode?: ContentMode | '';
    railWidth?: number;
    indicatorBounceVersion?: number;
    emphasisVersion?: number;
    onChange?: (mode: ContentMode) => void;
}
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { CARD_RADIUS_SM, CHIP_RADIUS } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
import curves from "@native:ohos.curves";
export type ContentMode = 'articles' | 'social' | 'pictures' | 'videos';
const CONTENT_MODES: ContentMode[] = ['articles', 'social', 'pictures', 'videos'];
const INDICATOR_MOVE_DURATION: number = 100;
const INDICATOR_BOUNCE_DURATION: number = 56;
export class ContentModeRail extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__mode = new SynchedPropertySimpleOneWayPU(params.mode, this, "mode");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.__pressedMode = new ObservedPropertySimplePU('', this, "pressedMode");
        this.__indicatorScaleX = new ObservedPropertySimplePU(1, this, "indicatorScaleX");
        this.__indicatorScaleY = new ObservedPropertySimplePU(1, this, "indicatorScaleY");
        this.__emphasizedMode = new ObservedPropertySimplePU('', this, "emphasizedMode");
        this.__railWidth = new ObservedPropertySimplePU(0, this, "railWidth");
        this.indicatorBounceVersion = 0;
        this.emphasisVersion = 0;
        this.onChange = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: ContentModeRail_Params) {
        if (params.mode === undefined) {
            this.__mode.set('articles');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.pressedMode !== undefined) {
            this.pressedMode = params.pressedMode;
        }
        if (params.indicatorScaleX !== undefined) {
            this.indicatorScaleX = params.indicatorScaleX;
        }
        if (params.indicatorScaleY !== undefined) {
            this.indicatorScaleY = params.indicatorScaleY;
        }
        if (params.emphasizedMode !== undefined) {
            this.emphasizedMode = params.emphasizedMode;
        }
        if (params.railWidth !== undefined) {
            this.railWidth = params.railWidth;
        }
        if (params.indicatorBounceVersion !== undefined) {
            this.indicatorBounceVersion = params.indicatorBounceVersion;
        }
        if (params.emphasisVersion !== undefined) {
            this.emphasisVersion = params.emphasisVersion;
        }
        if (params.onChange !== undefined) {
            this.onChange = params.onChange;
        }
    }
    updateStateVars(params: ContentModeRail_Params) {
        this.__mode.reset(params.mode);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__mode.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__pressedMode.purgeDependencyOnElmtId(rmElmtId);
        this.__indicatorScaleX.purgeDependencyOnElmtId(rmElmtId);
        this.__indicatorScaleY.purgeDependencyOnElmtId(rmElmtId);
        this.__emphasizedMode.purgeDependencyOnElmtId(rmElmtId);
        this.__railWidth.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__mode.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__pressedMode.aboutToBeDeleted();
        this.__indicatorScaleX.aboutToBeDeleted();
        this.__indicatorScaleY.aboutToBeDeleted();
        this.__emphasizedMode.aboutToBeDeleted();
        this.__railWidth.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __mode: SynchedPropertySimpleOneWayPU<ContentMode>;
    get mode() {
        return this.__mode.get();
    }
    set mode(newValue: ContentMode) {
        this.__mode.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __pressedMode: ObservedPropertySimplePU<ContentMode | ''>;
    get pressedMode() {
        return this.__pressedMode.get();
    }
    set pressedMode(newValue: ContentMode | '') {
        this.__pressedMode.set(newValue);
    }
    private __indicatorScaleX: ObservedPropertySimplePU<number>;
    get indicatorScaleX() {
        return this.__indicatorScaleX.get();
    }
    set indicatorScaleX(newValue: number) {
        this.__indicatorScaleX.set(newValue);
    }
    private __indicatorScaleY: ObservedPropertySimplePU<number>;
    get indicatorScaleY() {
        return this.__indicatorScaleY.get();
    }
    set indicatorScaleY(newValue: number) {
        this.__indicatorScaleY.set(newValue);
    }
    private __emphasizedMode: ObservedPropertySimplePU<ContentMode | ''>;
    get emphasizedMode() {
        return this.__emphasizedMode.get();
    }
    set emphasizedMode(newValue: ContentMode | '') {
        this.__emphasizedMode.set(newValue);
    }
    private __railWidth: ObservedPropertySimplePU<number>;
    get railWidth() {
        return this.__railWidth.get();
    }
    set railWidth(newValue: number) {
        this.__railWidth.set(newValue);
    }
    private indicatorBounceVersion: number;
    private emphasisVersion: number;
    private onChange: (mode: ContentMode) => void;
    private modeIndex(mode: ContentMode): number {
        return CONTENT_MODES.indexOf(mode);
    }
    private isPressed(mode: ContentMode): boolean {
        return this.pressedMode === mode;
    }
    private indicatorSlotWidth(): number {
        if (this.railWidth <= 0) {
            return 0;
        }
        return (this.railWidth - 8) / CONTENT_MODES.length;
    }
    private indicatorOffsetX(): number {
        return this.indicatorSlotWidth() * this.modeIndex(this.mode);
    }
    private updateRailWidth(width: Length | undefined): void {
        if (width === undefined) {
            this.railWidth = 0;
            return;
        }
        if (typeof width === 'number') {
            this.railWidth = width;
            return;
        }
        this.railWidth = 0;
    }
    private itemScale(mode: ContentMode): number {
        if (this.mode === mode) {
            return this.isPressed(mode) ? 0.98 : 1;
        }
        return this.isPressed(mode) ? 0.96 : 1;
    }
    private itemOpacity(mode: ContentMode): number {
        if (this.mode === mode) {
            return 1;
        }
        return this.isPressed(mode) ? 0.9 : 0.94;
    }
    private isEmphasized(mode: ContentMode): boolean {
        return this.emphasizedMode === mode;
    }
    private iconScale(mode: ContentMode): number {
        if (this.isEmphasized(mode)) {
            return 1.12;
        }
        if (this.mode === mode) {
            return 1.04;
        }
        return 1;
    }
    private iconOffset(mode: ContentMode): number {
        if (this.isEmphasized(mode)) {
            return -1.5;
        }
        if (this.mode === mode) {
            return -0.5;
        }
        return 0;
    }
    private labelOffset(mode: ContentMode): number {
        if (this.isEmphasized(mode)) {
            return -0.8;
        }
        return this.mode === mode ? -0.2 : 0;
    }
    private activeTextColor(): string {
        return this.theme.isDark ? '#F5F8FF' : '#14213D';
    }
    private indicatorColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)';
    }
    private indicatorBorderColor(): string {
        return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)';
    }
    private indicatorShadowColor(): string {
        return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)';
    }
    private indicatorShadowRadius(): number {
        return this.indicatorScaleX > 1 ? 10 : 8;
    }
    private triggerIndicatorBounce(nextMode: ContentMode): void {
        if (nextMode === this.mode) {
            return;
        }
        this.indicatorBounceVersion += 1;
        const version = this.indicatorBounceVersion;
        this.indicatorScaleX = 1.055;
        this.indicatorScaleY = 0.94;
        setTimeout(() => {
            if (version !== this.indicatorBounceVersion) {
                return;
            }
            this.indicatorScaleX = 1;
            this.indicatorScaleY = 1;
        }, INDICATOR_BOUNCE_DURATION);
    }
    private triggerModeEmphasis(nextMode: ContentMode): void {
        if (nextMode === this.mode) {
            return;
        }
        this.emphasisVersion += 1;
        const version = this.emphasisVersion;
        this.emphasizedMode = nextMode;
        setTimeout(() => {
            if (version !== this.emphasisVersion) {
                return;
            }
            this.emphasizedMode = '';
        }, 140);
    }
    private labelFor(mode: ContentMode): string {
        switch (mode) {
            case 'articles':
                return '文章';
            case 'social':
                return '社交';
            case 'pictures':
                return '图片';
            case 'videos':
                return '视频';
            default:
                return '';
        }
    }
    private ModeIcon(mode: ContentMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (mode === 'articles') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777239, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Context.animation({ duration: 200, curve: curves.springMotion() });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                        Image.scale({ x: this.iconScale(mode), y: this.iconScale(mode) });
                        Image.translate({ y: this.iconOffset(mode) });
                        Context.animation(null);
                    }, Image);
                });
            }
            else if (mode === 'social') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777243, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Context.animation({ duration: 200, curve: curves.springMotion() });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                        Image.scale({ x: this.iconScale(mode), y: this.iconScale(mode) });
                        Image.translate({ y: this.iconOffset(mode) });
                        Context.animation(null);
                    }, Image);
                });
            }
            else if (mode === 'pictures') {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777241, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Context.animation({ duration: 200, curve: curves.springMotion() });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                        Image.scale({ x: this.iconScale(mode), y: this.iconScale(mode) });
                        Image.translate({ y: this.iconOffset(mode) });
                        Context.animation(null);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create({ "id": 16777245, "type": 20000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
                        Context.animation({ duration: 200, curve: curves.springMotion() });
                        Image.width(16);
                        Image.height(16);
                        Image.objectFit(ImageFit.Contain);
                        Image.scale({ x: this.iconScale(mode), y: this.iconScale(mode) });
                        Image.translate({ y: this.iconOffset(mode) });
                        Context.animation(null);
                    }, Image);
                });
            }
        }, If);
        If.pop();
    }
    private ModeTab(mode: ContentMode, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 6 });
            Context.animation({ duration: 160, curve: Curve.EaseInOut });
            Row.layoutWeight(1);
            Row.height(38);
            Row.justifyContent(FlexAlign.Center);
            Row.borderRadius(CHIP_RADIUS);
            Row.scale({ x: this.itemScale(mode), y: this.itemScale(mode) });
            Row.opacity(this.itemOpacity(mode));
            Context.animation(null);
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.pressedMode = mode;
                    return;
                }
                if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
                    if (this.pressedMode === mode) {
                        this.pressedMode = '';
                    }
                }
            });
            Row.onClick(() => {
                this.triggerIndicatorBounce(mode);
                this.triggerModeEmphasis(mode);
                this.onChange(mode);
            });
        }, Row);
        this.ModeIcon.bind(this)(mode);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.labelFor(mode));
            Context.animation({ duration: 160, curve: Curve.EaseInOut });
            Text.fontSize(14);
            Text.fontWeight(this.mode === mode ? FontWeight.Medium : FontWeight.Regular);
            Text.fontColor(this.mode === mode ? this.activeTextColor() : this.theme.textSecondary);
            Text.translate({ y: this.labelOffset(mode) });
            Context.animation(null);
        }, Text);
        Text.pop();
        Row.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
            Stack.width('100%');
            Stack.height(46);
            Stack.padding(4);
            Stack.backgroundColor(this.theme.elevated);
            Stack.borderRadius(CARD_RADIUS_SM);
            Stack.border({ width: 0.8, color: this.theme.divider });
            Stack.onSizeChange((_, newValue) => {
                this.updateRailWidth(newValue.width);
            });
            Stack.transition(livoMotion.enterScale(30));
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height('100%');
            Row.justifyContent(FlexAlign.Start);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Context.animation({ duration: INDICATOR_MOVE_DURATION, curve: Curve.EaseOut });
            Row.width(this.indicatorSlotWidth());
            Row.height(38);
            Row.scale({ x: this.indicatorScaleX, y: this.indicatorScaleY });
            Row.translate({ x: this.indicatorOffsetX() });
            Row.backgroundColor(this.indicatorColor());
            Row.borderRadius(CHIP_RADIUS);
            Row.border({ width: 0.6, color: this.indicatorBorderColor() });
            Row.shadow({
                radius: this.indicatorShadowRadius(),
                color: this.indicatorShadowColor(),
                offsetX: 0,
                offsetY: 2,
            });
            Context.animation(null);
        }, Row);
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 0 });
            Row.width('100%');
            Row.height('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const mode = _item;
                this.ModeTab.bind(this)(mode);
            };
            this.forEachUpdateFunction(elmtId, CONTENT_MODES, forEachItemGenFunction, (mode: ContentMode) => mode, false, false);
        }, ForEach);
        ForEach.pop();
        Row.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

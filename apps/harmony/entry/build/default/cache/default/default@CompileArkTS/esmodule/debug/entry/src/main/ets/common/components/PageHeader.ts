if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface PageHeader_Params {
    isBackPressed?: boolean;
    isTrailingPressed?: boolean;
    title?: string;
    subtitle?: string;
    theme?: ThemePalette;
    showBackButton?: boolean;
    trailingSymbol?: Resource | null;
    trailingText?: string;
    trailingButtonCircular?: boolean;
    trailingSymbolSize?: number;
    trailingSymbolColor?: string;
    trailingButtonBackground?: string;
    showTrailingBuilder?: boolean;
    titleSize?: number;
    subtitleSize?: number;
    minHeight?: number;
    topPadding?: number;
    bottomPadding?: number;
    onTrailingClick?: () => void;
    onBack?: () => void;
    trailingBuilder?: () => void;
}
import curves from "@native:ohos.curves";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { ACTION_ICON_SIZE, HEADER_BACK_SLOT_SIZE, HEADER_MIN_HEIGHT, HEADER_TITLE_GAP, TITLE_FONT_SIZE } from "@bundle:com.livo.harmony/entry/ets/common/ui/UiTokens";
export class PageHeader extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__isBackPressed = new ObservedPropertySimplePU(false, this, "isBackPressed");
        this.__isTrailingPressed = new ObservedPropertySimplePU(false, this, "isTrailingPressed");
        this.__title = new SynchedPropertySimpleOneWayPU(params.title, this, "title");
        this.__subtitle = new SynchedPropertySimpleOneWayPU(params.subtitle, this, "subtitle");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.__showBackButton = new SynchedPropertySimpleOneWayPU(params.showBackButton, this, "showBackButton");
        this.__trailingSymbol = new SynchedPropertyObjectOneWayPU(params.trailingSymbol, this, "trailingSymbol");
        this.__trailingText = new SynchedPropertySimpleOneWayPU(params.trailingText, this, "trailingText");
        this.__trailingButtonCircular = new SynchedPropertySimpleOneWayPU(params.trailingButtonCircular, this, "trailingButtonCircular");
        this.__trailingSymbolSize = new SynchedPropertySimpleOneWayPU(params.trailingSymbolSize, this, "trailingSymbolSize");
        this.__trailingSymbolColor = new SynchedPropertySimpleOneWayPU(params.trailingSymbolColor, this, "trailingSymbolColor");
        this.__trailingButtonBackground = new SynchedPropertySimpleOneWayPU(params.trailingButtonBackground, this, "trailingButtonBackground");
        this.__showTrailingBuilder = new SynchedPropertySimpleOneWayPU(params.showTrailingBuilder, this, "showTrailingBuilder");
        this.__titleSize = new SynchedPropertySimpleOneWayPU(params.titleSize, this, "titleSize");
        this.__subtitleSize = new SynchedPropertySimpleOneWayPU(params.subtitleSize, this, "subtitleSize");
        this.__minHeight = new SynchedPropertySimpleOneWayPU(params.minHeight, this, "minHeight");
        this.__topPadding = new SynchedPropertySimpleOneWayPU(params.topPadding, this, "topPadding");
        this.__bottomPadding = new SynchedPropertySimpleOneWayPU(params.bottomPadding, this, "bottomPadding");
        this.onTrailingClick = () => { };
        this.onBack = () => { };
        this.trailingBuilder = this.EmptyTrailingBuilder;
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: PageHeader_Params) {
        if (params.isBackPressed !== undefined) {
            this.isBackPressed = params.isBackPressed;
        }
        if (params.isTrailingPressed !== undefined) {
            this.isTrailingPressed = params.isTrailingPressed;
        }
        if (params.title === undefined) {
            this.__title.set('');
        }
        if (params.subtitle === undefined) {
            this.__subtitle.set('');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.showBackButton === undefined) {
            this.__showBackButton.set(false);
        }
        if (params.trailingSymbol === undefined) {
            this.__trailingSymbol.set(null);
        }
        if (params.trailingText === undefined) {
            this.__trailingText.set('');
        }
        if (params.trailingButtonCircular === undefined) {
            this.__trailingButtonCircular.set(false);
        }
        if (params.trailingSymbolSize === undefined) {
            this.__trailingSymbolSize.set(ACTION_ICON_SIZE);
        }
        if (params.trailingSymbolColor === undefined) {
            this.__trailingSymbolColor.set('');
        }
        if (params.trailingButtonBackground === undefined) {
            this.__trailingButtonBackground.set('');
        }
        if (params.showTrailingBuilder === undefined) {
            this.__showTrailingBuilder.set(false);
        }
        if (params.titleSize === undefined) {
            this.__titleSize.set(TITLE_FONT_SIZE);
        }
        if (params.subtitleSize === undefined) {
            this.__subtitleSize.set(11);
        }
        if (params.minHeight === undefined) {
            this.__minHeight.set(HEADER_MIN_HEIGHT);
        }
        if (params.topPadding === undefined) {
            this.__topPadding.set(0);
        }
        if (params.bottomPadding === undefined) {
            this.__bottomPadding.set(0);
        }
        if (params.onTrailingClick !== undefined) {
            this.onTrailingClick = params.onTrailingClick;
        }
        if (params.onBack !== undefined) {
            this.onBack = params.onBack;
        }
        if (params.trailingBuilder !== undefined) {
            this.trailingBuilder = params.trailingBuilder;
        }
    }
    updateStateVars(params: PageHeader_Params) {
        this.__title.reset(params.title);
        this.__subtitle.reset(params.subtitle);
        this.__theme.reset(params.theme);
        this.__showBackButton.reset(params.showBackButton);
        this.__trailingSymbol.reset(params.trailingSymbol);
        this.__trailingText.reset(params.trailingText);
        this.__trailingButtonCircular.reset(params.trailingButtonCircular);
        this.__trailingSymbolSize.reset(params.trailingSymbolSize);
        this.__trailingSymbolColor.reset(params.trailingSymbolColor);
        this.__trailingButtonBackground.reset(params.trailingButtonBackground);
        this.__showTrailingBuilder.reset(params.showTrailingBuilder);
        this.__titleSize.reset(params.titleSize);
        this.__subtitleSize.reset(params.subtitleSize);
        this.__minHeight.reset(params.minHeight);
        this.__topPadding.reset(params.topPadding);
        this.__bottomPadding.reset(params.bottomPadding);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__isBackPressed.purgeDependencyOnElmtId(rmElmtId);
        this.__isTrailingPressed.purgeDependencyOnElmtId(rmElmtId);
        this.__title.purgeDependencyOnElmtId(rmElmtId);
        this.__subtitle.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__showBackButton.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingSymbol.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingText.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingButtonCircular.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingSymbolSize.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingSymbolColor.purgeDependencyOnElmtId(rmElmtId);
        this.__trailingButtonBackground.purgeDependencyOnElmtId(rmElmtId);
        this.__showTrailingBuilder.purgeDependencyOnElmtId(rmElmtId);
        this.__titleSize.purgeDependencyOnElmtId(rmElmtId);
        this.__subtitleSize.purgeDependencyOnElmtId(rmElmtId);
        this.__minHeight.purgeDependencyOnElmtId(rmElmtId);
        this.__topPadding.purgeDependencyOnElmtId(rmElmtId);
        this.__bottomPadding.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__isBackPressed.aboutToBeDeleted();
        this.__isTrailingPressed.aboutToBeDeleted();
        this.__title.aboutToBeDeleted();
        this.__subtitle.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__showBackButton.aboutToBeDeleted();
        this.__trailingSymbol.aboutToBeDeleted();
        this.__trailingText.aboutToBeDeleted();
        this.__trailingButtonCircular.aboutToBeDeleted();
        this.__trailingSymbolSize.aboutToBeDeleted();
        this.__trailingSymbolColor.aboutToBeDeleted();
        this.__trailingButtonBackground.aboutToBeDeleted();
        this.__showTrailingBuilder.aboutToBeDeleted();
        this.__titleSize.aboutToBeDeleted();
        this.__subtitleSize.aboutToBeDeleted();
        this.__minHeight.aboutToBeDeleted();
        this.__topPadding.aboutToBeDeleted();
        this.__bottomPadding.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __isBackPressed: ObservedPropertySimplePU<boolean>;
    get isBackPressed() {
        return this.__isBackPressed.get();
    }
    set isBackPressed(newValue: boolean) {
        this.__isBackPressed.set(newValue);
    }
    private __isTrailingPressed: ObservedPropertySimplePU<boolean>;
    get isTrailingPressed() {
        return this.__isTrailingPressed.get();
    }
    set isTrailingPressed(newValue: boolean) {
        this.__isTrailingPressed.set(newValue);
    }
    private __title: SynchedPropertySimpleOneWayPU<string>;
    get title() {
        return this.__title.get();
    }
    set title(newValue: string) {
        this.__title.set(newValue);
    }
    private __subtitle: SynchedPropertySimpleOneWayPU<string>;
    get subtitle() {
        return this.__subtitle.get();
    }
    set subtitle(newValue: string) {
        this.__subtitle.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __showBackButton: SynchedPropertySimpleOneWayPU<boolean>;
    get showBackButton() {
        return this.__showBackButton.get();
    }
    set showBackButton(newValue: boolean) {
        this.__showBackButton.set(newValue);
    }
    private __trailingSymbol: SynchedPropertySimpleOneWayPU<Resource | null>;
    get trailingSymbol() {
        return this.__trailingSymbol.get();
    }
    set trailingSymbol(newValue: Resource | null) {
        this.__trailingSymbol.set(newValue);
    }
    private __trailingText: SynchedPropertySimpleOneWayPU<string>;
    get trailingText() {
        return this.__trailingText.get();
    }
    set trailingText(newValue: string) {
        this.__trailingText.set(newValue);
    }
    private __trailingButtonCircular: SynchedPropertySimpleOneWayPU<boolean>;
    get trailingButtonCircular() {
        return this.__trailingButtonCircular.get();
    }
    set trailingButtonCircular(newValue: boolean) {
        this.__trailingButtonCircular.set(newValue);
    }
    private __trailingSymbolSize: SynchedPropertySimpleOneWayPU<number>;
    get trailingSymbolSize() {
        return this.__trailingSymbolSize.get();
    }
    set trailingSymbolSize(newValue: number) {
        this.__trailingSymbolSize.set(newValue);
    }
    private __trailingSymbolColor: SynchedPropertySimpleOneWayPU<string>;
    get trailingSymbolColor() {
        return this.__trailingSymbolColor.get();
    }
    set trailingSymbolColor(newValue: string) {
        this.__trailingSymbolColor.set(newValue);
    }
    private __trailingButtonBackground: SynchedPropertySimpleOneWayPU<string>;
    get trailingButtonBackground() {
        return this.__trailingButtonBackground.get();
    }
    set trailingButtonBackground(newValue: string) {
        this.__trailingButtonBackground.set(newValue);
    }
    private __showTrailingBuilder: SynchedPropertySimpleOneWayPU<boolean>;
    get showTrailingBuilder() {
        return this.__showTrailingBuilder.get();
    }
    set showTrailingBuilder(newValue: boolean) {
        this.__showTrailingBuilder.set(newValue);
    }
    private __titleSize: SynchedPropertySimpleOneWayPU<number>;
    get titleSize() {
        return this.__titleSize.get();
    }
    set titleSize(newValue: number) {
        this.__titleSize.set(newValue);
    }
    private __subtitleSize: SynchedPropertySimpleOneWayPU<number>;
    get subtitleSize() {
        return this.__subtitleSize.get();
    }
    set subtitleSize(newValue: number) {
        this.__subtitleSize.set(newValue);
    }
    private __minHeight: SynchedPropertySimpleOneWayPU<number>;
    get minHeight() {
        return this.__minHeight.get();
    }
    set minHeight(newValue: number) {
        this.__minHeight.set(newValue);
    }
    private __topPadding: SynchedPropertySimpleOneWayPU<number>;
    get topPadding() {
        return this.__topPadding.get();
    }
    set topPadding(newValue: number) {
        this.__topPadding.set(newValue);
    }
    private __bottomPadding: SynchedPropertySimpleOneWayPU<number>;
    get bottomPadding() {
        return this.__bottomPadding.get();
    }
    set bottomPadding(newValue: number) {
        this.__bottomPadding.set(newValue);
    }
    private onTrailingClick: () => void;
    private onBack: () => void;
    private EmptyTrailingBuilder(parent = null) {
    }
    private __trailingBuilder;
    private BackButton(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('‹');
            Context.animation({ duration: 120, curve: Curve.EaseOut });
            Text.fontSize(28);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
            Text.width(HEADER_BACK_SLOT_SIZE);
            Text.height(HEADER_BACK_SLOT_SIZE);
            Text.textAlign(TextAlign.Center);
            Text.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Text.scale({
                x: this.isBackPressed ? 0.92 : 1,
                y: this.isBackPressed ? 0.92 : 1,
            });
            Text.opacity(this.isBackPressed ? 0.72 : 1);
            Context.animation(null);
            Text.onTouch((event: TouchEvent) => {
                if (event.type === TouchType.Down) {
                    this.isBackPressed = true;
                    return;
                }
                this.isBackPressed = false;
            });
            Text.onClick(() => {
                this.onBack();
            });
        }, Text);
        Text.pop();
    }
    private TrailingAction(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.trailingText) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.trailingText);
                        Text.fontSize(14);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor(this.theme.accent);
                        Text.height(HEADER_BACK_SLOT_SIZE);
                        Text.padding({ left: 12, right: 4 });
                        Text.textAlign(TextAlign.End);
                        Text.clickEffect({ level: ClickEffectLevel.MIDDLE });
                        Text.onClick(() => {
                            this.onTrailingClick();
                        });
                    }, Text);
                    Text.pop();
                });
            }
            else if (this.trailingSymbol !== null) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Context.animation({
                            duration: this.isTrailingPressed ? 90 : 280,
                            curve: this.isTrailingPressed ? Curve.EaseOut : curves.springMotion(0.32, 0.88),
                        });
                        Row.width(HEADER_BACK_SLOT_SIZE);
                        Row.height(HEADER_BACK_SLOT_SIZE);
                        Row.justifyContent(FlexAlign.Center);
                        Row.alignItems(VerticalAlign.Center);
                        Row.margin(this.trailingButtonCircular ? { top: -2, left: -5 } : {});
                        Row.backgroundColor(this.trailingButtonBackground || this.theme.elevated);
                        Row.borderRadius(this.trailingButtonCircular ? HEADER_BACK_SLOT_SIZE : 15);
                        Row.border(this.trailingButtonCircular ? { width: 0 } : { width: 0.8, color: this.theme.divider });
                        Row.shadow(this.trailingButtonCircular
                            ? { radius: 0, color: 'rgba(0,0,0,0)', offsetY: 0 }
                            : { radius: 8, color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)', offsetY: 2 });
                        Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
                        Row.scale({
                            x: this.isTrailingPressed ? 0.84 : 1,
                            y: this.isTrailingPressed ? 0.84 : 1,
                        });
                        Row.opacity(this.isTrailingPressed ? 0.76 : 1);
                        Context.animation(null);
                        Row.onTouch((event: TouchEvent) => {
                            if (event.type === TouchType.Down) {
                                this.isTrailingPressed = true;
                                return;
                            }
                            this.isTrailingPressed = false;
                        });
                        Row.onClick(() => {
                            this.onTrailingClick();
                        });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        SymbolGlyph.create(this.trailingSymbol);
                        SymbolGlyph.fontSize(this.trailingSymbolSize);
                        SymbolGlyph.fontColor([this.trailingSymbolColor || this.theme.textPrimary]);
                    }, SymbolGlyph);
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.constraintSize({ minHeight: this.minHeight });
            Row.padding({ top: this.topPadding, bottom: this.bottomPadding });
            Row.alignItems(VerticalAlign.Center);
            Row.transition(livoMotion.enterRise(20));
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showBackButton) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.BackButton.bind(this)();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: this.subtitle ? 6 : 0 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
            Column.padding({ left: this.showBackButton ? HEADER_TITLE_GAP : 0 });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.subtitle) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.subtitle);
                        Text.fontSize(this.subtitleSize);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor(this.theme.textMuted);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
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
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.title);
            Text.fontSize(this.titleSize);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.showTrailingBuilder) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.trailingBuilder.bind(this)();
                });
            }
            else if (this.trailingText || this.trailingSymbol !== null) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.TrailingAction.bind(this)();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
        Row.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

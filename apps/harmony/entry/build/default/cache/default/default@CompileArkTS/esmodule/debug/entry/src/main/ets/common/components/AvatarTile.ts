if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AvatarTile_Params {
    imageUrl?: string;
    fallbackLabel?: string;
    accent?: string;
    theme?: ThemePalette;
    avatarSize?: number;
    radius?: number;
    textSize?: number;
    showFallbackLabel?: boolean;
    imageLoadFailed?: boolean;
}
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
export class AvatarTile extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__imageUrl = new SynchedPropertySimpleOneWayPU(params.imageUrl, this, "imageUrl");
        this.__fallbackLabel = new SynchedPropertySimpleOneWayPU(params.fallbackLabel, this, "fallbackLabel");
        this.__accent = new SynchedPropertySimpleOneWayPU(params.accent, this, "accent");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.__avatarSize = new SynchedPropertySimpleOneWayPU(params.avatarSize, this, "avatarSize");
        this.__radius = new SynchedPropertySimpleOneWayPU(params.radius, this, "radius");
        this.__textSize = new SynchedPropertySimpleOneWayPU(params.textSize, this, "textSize");
        this.__showFallbackLabel = new SynchedPropertySimpleOneWayPU(params.showFallbackLabel, this, "showFallbackLabel");
        this.__imageLoadFailed = new ObservedPropertySimplePU(false, this, "imageLoadFailed");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AvatarTile_Params) {
        if (params.imageUrl === undefined) {
            this.__imageUrl.set('');
        }
        if (params.fallbackLabel === undefined) {
            this.__fallbackLabel.set('');
        }
        if (params.accent === undefined) {
            this.__accent.set('#FF6A00');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.avatarSize === undefined) {
            this.__avatarSize.set(38);
        }
        if (params.radius === undefined) {
            this.__radius.set(10);
        }
        if (params.textSize === undefined) {
            this.__textSize.set(14);
        }
        if (params.showFallbackLabel === undefined) {
            this.__showFallbackLabel.set(true);
        }
        if (params.imageLoadFailed !== undefined) {
            this.imageLoadFailed = params.imageLoadFailed;
        }
    }
    updateStateVars(params: AvatarTile_Params) {
        this.__imageUrl.reset(params.imageUrl);
        this.__fallbackLabel.reset(params.fallbackLabel);
        this.__accent.reset(params.accent);
        this.__theme.reset(params.theme);
        this.__avatarSize.reset(params.avatarSize);
        this.__radius.reset(params.radius);
        this.__textSize.reset(params.textSize);
        this.__showFallbackLabel.reset(params.showFallbackLabel);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__imageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__fallbackLabel.purgeDependencyOnElmtId(rmElmtId);
        this.__accent.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__avatarSize.purgeDependencyOnElmtId(rmElmtId);
        this.__radius.purgeDependencyOnElmtId(rmElmtId);
        this.__textSize.purgeDependencyOnElmtId(rmElmtId);
        this.__showFallbackLabel.purgeDependencyOnElmtId(rmElmtId);
        this.__imageLoadFailed.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__imageUrl.aboutToBeDeleted();
        this.__fallbackLabel.aboutToBeDeleted();
        this.__accent.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__avatarSize.aboutToBeDeleted();
        this.__radius.aboutToBeDeleted();
        this.__textSize.aboutToBeDeleted();
        this.__showFallbackLabel.aboutToBeDeleted();
        this.__imageLoadFailed.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __imageUrl: SynchedPropertySimpleOneWayPU<string>;
    get imageUrl() {
        return this.__imageUrl.get();
    }
    set imageUrl(newValue: string) {
        this.__imageUrl.set(newValue);
    }
    private __fallbackLabel: SynchedPropertySimpleOneWayPU<string>;
    get fallbackLabel() {
        return this.__fallbackLabel.get();
    }
    set fallbackLabel(newValue: string) {
        this.__fallbackLabel.set(newValue);
    }
    private __accent: SynchedPropertySimpleOneWayPU<string>;
    get accent() {
        return this.__accent.get();
    }
    set accent(newValue: string) {
        this.__accent.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __avatarSize: SynchedPropertySimpleOneWayPU<number>;
    get avatarSize() {
        return this.__avatarSize.get();
    }
    set avatarSize(newValue: number) {
        this.__avatarSize.set(newValue);
    }
    private __radius: SynchedPropertySimpleOneWayPU<number>;
    get radius() {
        return this.__radius.get();
    }
    set radius(newValue: number) {
        this.__radius.set(newValue);
    }
    private __textSize: SynchedPropertySimpleOneWayPU<number>;
    get textSize() {
        return this.__textSize.get();
    }
    set textSize(newValue: number) {
        this.__textSize.set(newValue);
    }
    private __showFallbackLabel: SynchedPropertySimpleOneWayPU<boolean>;
    get showFallbackLabel() {
        return this.__showFallbackLabel.get();
    }
    set showFallbackLabel(newValue: boolean) {
        this.__showFallbackLabel.set(newValue);
    }
    private __imageLoadFailed: ObservedPropertySimplePU<boolean>;
    get imageLoadFailed() {
        return this.__imageLoadFailed.get();
    }
    set imageLoadFailed(newValue: boolean) {
        this.__imageLoadFailed.set(newValue);
    }
    aboutToAppear(): void {
        this.imageLoadFailed = false;
    }
    private initialsLabel(): string {
        const trimmed = this.fallbackLabel.trim();
        if (!trimmed) {
            return '?';
        }
        return trimmed.substring(0, 1).toUpperCase();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create({ alignContent: Alignment.Center });
        }, Stack);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.imageUrl && !this.imageLoadFailed) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.imageUrl);
                        Image.width(this.avatarSize);
                        Image.height(this.avatarSize);
                        Image.borderRadius(this.radius);
                        Image.backgroundColor(this.theme.elevated);
                        Image.objectFit(ImageFit.Cover);
                        Image.onError(() => {
                            this.imageLoadFailed = true;
                        });
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(this.avatarSize);
                        Row.height(this.avatarSize);
                        Row.borderRadius(this.radius);
                        Row.backgroundColor(this.theme.elevated);
                        Row.border({
                            width: 0.8,
                            color: this.theme.divider,
                        });
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.showFallbackLabel) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.initialsLabel());
                                    Text.fontSize(this.textSize);
                                    Text.fontWeight(FontWeight.Bold);
                                    Text.fontColor('#FFFFFF');
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
                });
            }
        }, If);
        If.pop();
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface SettingListRow_Params {
    title?: string;
    symbol?: Resource;
    symbolColor?: string;
    subtitle?: string;
    hint?: string;
    theme?: ThemePalette;
    onTap?: () => void;
}
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
export class SettingListRow extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__title = new SynchedPropertySimpleOneWayPU(params.title, this, "title");
        this.__symbol = new SynchedPropertyObjectOneWayPU(params.symbol, this, "symbol");
        this.__symbolColor = new SynchedPropertySimpleOneWayPU(params.symbolColor, this, "symbolColor");
        this.__subtitle = new SynchedPropertySimpleOneWayPU(params.subtitle, this, "subtitle");
        this.__hint = new SynchedPropertySimpleOneWayPU(params.hint, this, "hint");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.onTap = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: SettingListRow_Params) {
        if (params.title === undefined) {
            this.__title.set('');
        }
        if (params.symbol === undefined) {
            this.__symbol.set({ "id": 125831493, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
        }
        if (params.symbolColor === undefined) {
            this.__symbolColor.set('#4B5563');
        }
        if (params.subtitle === undefined) {
            this.__subtitle.set('');
        }
        if (params.hint === undefined) {
            this.__hint.set('');
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.onTap !== undefined) {
            this.onTap = params.onTap;
        }
    }
    updateStateVars(params: SettingListRow_Params) {
        this.__title.reset(params.title);
        this.__symbol.reset(params.symbol);
        this.__symbolColor.reset(params.symbolColor);
        this.__subtitle.reset(params.subtitle);
        this.__hint.reset(params.hint);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__title.purgeDependencyOnElmtId(rmElmtId);
        this.__symbol.purgeDependencyOnElmtId(rmElmtId);
        this.__symbolColor.purgeDependencyOnElmtId(rmElmtId);
        this.__subtitle.purgeDependencyOnElmtId(rmElmtId);
        this.__hint.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__title.aboutToBeDeleted();
        this.__symbol.aboutToBeDeleted();
        this.__symbolColor.aboutToBeDeleted();
        this.__subtitle.aboutToBeDeleted();
        this.__hint.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __title: SynchedPropertySimpleOneWayPU<string>;
    get title() {
        return this.__title.get();
    }
    set title(newValue: string) {
        this.__title.set(newValue);
    }
    private __symbol: SynchedPropertySimpleOneWayPU<Resource>;
    get symbol() {
        return this.__symbol.get();
    }
    set symbol(newValue: Resource) {
        this.__symbol.set(newValue);
    }
    private __symbolColor: SynchedPropertySimpleOneWayPU<string>;
    get symbolColor() {
        return this.__symbolColor.get();
    }
    set symbolColor(newValue: string) {
        this.__symbolColor.set(newValue);
    }
    private __subtitle: SynchedPropertySimpleOneWayPU<string>;
    get subtitle() {
        return this.__subtitle.get();
    }
    set subtitle(newValue: string) {
        this.__subtitle.set(newValue);
    }
    private __hint: SynchedPropertySimpleOneWayPU<string>;
    get hint() {
        return this.__hint.get();
    }
    set hint(newValue: string) {
        this.__hint.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private onTap: () => void;
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
            Row.height(this.subtitle ? 60 : 56);
            Row.borderRadius(20);
            Row.backgroundColor(this.theme.elevated);
            Row.clickEffect({ level: ClickEffectLevel.MIDDLE });
            Row.transition(livoMotion.enterScale());
            Row.alignItems(VerticalAlign.Center);
            Row.onClick(() => this.onTap());
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            SymbolGlyph.create(this.symbol);
            SymbolGlyph.fontSize(24);
            SymbolGlyph.margin({ left: 12, right: 10 });
            SymbolGlyph.fontColor([this.symbolColor]);
        }, SymbolGlyph);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: this.subtitle ? 2 : 0 });
            Column.layoutWeight(1);
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.title);
            Text.fontSize(17);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.subtitle) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.subtitle);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
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
        Column.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.hint) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.hint);
                        Text.fontSize(14);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.padding({ left: 8 });
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
            SymbolGlyph.create({ "id": 125832664, "type": 40000, params: [], "bundleName": "com.livo.harmony", "moduleName": "entry" });
            SymbolGlyph.fontSize(24);
            SymbolGlyph.margin({ left: 12, right: 12 });
            SymbolGlyph.fontColor([this.theme.textSecondary]);
        }, SymbolGlyph);
        Row.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

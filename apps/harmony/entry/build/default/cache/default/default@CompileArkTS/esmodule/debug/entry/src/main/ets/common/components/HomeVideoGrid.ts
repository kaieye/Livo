if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface HomeVideoGrid_Params {
    entries?: EntryCardModel[];
    onOpenEntry?: (entry: EntryCardModel) => void;
    theme?: ThemePalette;
    inheritedTheme?: ThemePalette;
}
import type { EntryCardModel } from '../models/LivoModels';
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { chunkHomeVideoEntries, resolveHomeVideoCardSubtitle, resolveHomeVideoCardTokens, resolveHomeVideoGridColumns, } from "@bundle:com.livo.harmony/entry/ets/common/utils/HomeVideoGrid";
export class HomeVideoGrid extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__entries = new SynchedPropertyObjectOneWayPU(params.entries, this, "entries");
        this.onOpenEntry = () => { };
        this.__theme = new ObservedPropertyObjectPU(ThemeService.currentPalette(), this, "theme");
        this.__inheritedTheme = new SynchedPropertyObjectOneWayPU(params.inheritedTheme, this, "inheritedTheme");
        this.setInitiallyProvidedValue(params);
        this.declareWatch("inheritedTheme", this.syncInheritedTheme);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: HomeVideoGrid_Params) {
        if (params.entries === undefined) {
            this.__entries.set([]);
        }
        if (params.onOpenEntry !== undefined) {
            this.onOpenEntry = params.onOpenEntry;
        }
        if (params.theme !== undefined) {
            this.theme = params.theme;
        }
        if (params.inheritedTheme === undefined) {
            this.__inheritedTheme.set(ThemeService.currentPalette());
        }
    }
    updateStateVars(params: HomeVideoGrid_Params) {
        this.__entries.reset(params.entries);
        this.__inheritedTheme.reset(params.inheritedTheme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__entries.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
        this.__inheritedTheme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__entries.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        this.__inheritedTheme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __entries: SynchedPropertySimpleOneWayPU<EntryCardModel[]>;
    get entries() {
        return this.__entries.get();
    }
    set entries(newValue: EntryCardModel[]) {
        this.__entries.set(newValue);
    }
    private onOpenEntry: (entry: EntryCardModel) => void;
    private __theme: ObservedPropertyObjectPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private __inheritedTheme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get inheritedTheme() {
        return this.__inheritedTheme.get();
    }
    set inheritedTheme(newValue: ThemePalette) {
        this.__inheritedTheme.set(newValue);
    }
    aboutToAppear(): void {
        this.theme = this.inheritedTheme;
    }
    private syncInheritedTheme(): void {
        this.theme = this.inheritedTheme;
    }
    private cardMeta(entry: EntryCardModel): string {
        return resolveHomeVideoCardSubtitle({
            feedTitle: entry.feedTitle,
            author: entry.author,
            publishedLabel: entry.publishedLabel,
        });
    }
    private rows(): EntryCardModel[][] {
        return chunkHomeVideoEntries(this.entries, resolveHomeVideoGridColumns());
    }
    private cardTokens() {
        return resolveHomeVideoCardTokens({
            isDark: this.theme.isDark,
            elevated: this.theme.elevated,
            textPrimary: this.theme.textPrimary,
            textSecondary: this.theme.textSecondary,
        });
    }
    private VideoCard(entry: EntryCardModel, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
            Column.onClick(() => {
                this.onOpenEntry(entry);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (entry.imageUrl) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(entry.imageUrl);
                        Image.width('100%');
                        Image.aspectRatio(16 / 9);
                        Image.objectFit(ImageFit.Cover);
                        Image.borderRadius(18);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create();
                        Column.width('100%');
                        Column.aspectRatio(16 / 9);
                        Column.backgroundColor(this.cardTokens().placeholderBackground);
                        Column.borderRadius(18);
                    }, Column);
                    Column.pop();
                });
            }
        }, If);
        If.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 4 });
            Column.width('100%');
            Column.alignItems(HorizontalAlign.Start);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(entry.title);
            Text.width('100%');
            Text.fontSize(14);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.cardTokens().titleColor);
            Text.maxLines(2);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.cardMeta(entry)) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.cardMeta(entry));
                        Text.width('100%');
                        Text.fontSize(11);
                        Text.fontColor(this.cardTokens().metaColor);
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
        Column.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 12 });
            Column.width('100%');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = (_item, rowIndex: number) => {
                const rowEntries = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create({ space: 12 });
                    Row.width('100%');
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    ForEach.create();
                    const forEachItemGenFunction = _item => {
                        const entry = _item;
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            Column.create();
                            Column.layoutWeight(1);
                        }, Column);
                        this.VideoCard.bind(this)(entry);
                        Column.pop();
                    };
                    this.forEachUpdateFunction(elmtId, rowEntries, forEachItemGenFunction, (entry: EntryCardModel) => entry.id, false, false);
                }, ForEach);
                ForEach.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    If.create();
                    if (rowEntries.length < resolveHomeVideoGridColumns()) {
                        this.ifElseBranchUpdateFunction(0, () => {
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Blank.create();
                                Blank.layoutWeight(1);
                            }, Blank);
                            Blank.pop();
                        });
                    }
                    else {
                        this.ifElseBranchUpdateFunction(1, () => {
                        });
                    }
                }, If);
                If.pop();
                Row.pop();
            };
            this.forEachUpdateFunction(elmtId, this.rows(), forEachItemGenFunction, (_rowEntries: EntryCardModel[], rowIndex: number) => `video-row-${rowIndex}`, true, true);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

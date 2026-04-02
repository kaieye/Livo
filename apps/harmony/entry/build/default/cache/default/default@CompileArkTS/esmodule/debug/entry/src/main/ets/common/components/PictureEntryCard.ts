if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface PictureEntryCard_Params {
    entry?: Entry;
    index?: number;
    authorLabel?: string;
    feedImageUrl?: string;
    caption?: string;
    pictureUrl?: string;
    galleryUrls?: string[];
    theme?: ThemePalette;
    onOpen?: () => void;
}
import { formatPublishedAt, selectPictureMediaUrls } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import type { Entry } from "@bundle:com.livo.harmony/entry/ets/common/models/LivoModels";
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import { createPictureGalleryTiles } from "@bundle:com.livo.harmony/entry/ets/common/utils/PictureGallery";
import type { PictureGalleryTile } from "@bundle:com.livo.harmony/entry/ets/common/utils/PictureGallery";
interface PictureEntryGalleryGridProps {
    galleryTiles: PictureGalleryTile[];
}
export class PictureEntryCard extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__entry = new SynchedPropertyObjectOneWayPU(params.entry, this, "entry");
        this.__index = new SynchedPropertySimpleOneWayPU(params.index, this, "index");
        this.__authorLabel = new SynchedPropertySimpleOneWayPU(params.authorLabel, this, "authorLabel");
        this.__feedImageUrl = new SynchedPropertySimpleOneWayPU(params.feedImageUrl, this, "feedImageUrl");
        this.__caption = new SynchedPropertySimpleOneWayPU(params.caption, this, "caption");
        this.__pictureUrl = new SynchedPropertySimpleOneWayPU(params.pictureUrl, this, "pictureUrl");
        this.__galleryUrls = new SynchedPropertyObjectOneWayPU(params.galleryUrls, this, "galleryUrls");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.onOpen = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: PictureEntryCard_Params) {
        if (params.entry === undefined) {
            this.__entry.set({} as Entry);
        }
        if (params.index === undefined) {
            this.__index.set(0);
        }
        if (params.authorLabel === undefined) {
            this.__authorLabel.set('');
        }
        if (params.feedImageUrl === undefined) {
            this.__feedImageUrl.set('');
        }
        if (params.caption === undefined) {
            this.__caption.set('');
        }
        if (params.pictureUrl === undefined) {
            this.__pictureUrl.set('');
        }
        if (params.galleryUrls === undefined) {
            this.__galleryUrls.set([]);
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.onOpen !== undefined) {
            this.onOpen = params.onOpen;
        }
    }
    updateStateVars(params: PictureEntryCard_Params) {
        this.__entry.reset(params.entry);
        this.__index.reset(params.index);
        this.__authorLabel.reset(params.authorLabel);
        this.__feedImageUrl.reset(params.feedImageUrl);
        this.__caption.reset(params.caption);
        this.__pictureUrl.reset(params.pictureUrl);
        this.__galleryUrls.reset(params.galleryUrls);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__entry.purgeDependencyOnElmtId(rmElmtId);
        this.__index.purgeDependencyOnElmtId(rmElmtId);
        this.__authorLabel.purgeDependencyOnElmtId(rmElmtId);
        this.__feedImageUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__caption.purgeDependencyOnElmtId(rmElmtId);
        this.__pictureUrl.purgeDependencyOnElmtId(rmElmtId);
        this.__galleryUrls.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__entry.aboutToBeDeleted();
        this.__index.aboutToBeDeleted();
        this.__authorLabel.aboutToBeDeleted();
        this.__feedImageUrl.aboutToBeDeleted();
        this.__caption.aboutToBeDeleted();
        this.__pictureUrl.aboutToBeDeleted();
        this.__galleryUrls.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __entry: SynchedPropertySimpleOneWayPU<Entry>;
    get entry() {
        return this.__entry.get();
    }
    set entry(newValue: Entry) {
        this.__entry.set(newValue);
    }
    private __index: SynchedPropertySimpleOneWayPU<number>;
    get index() {
        return this.__index.get();
    }
    set index(newValue: number) {
        this.__index.set(newValue);
    }
    private __authorLabel: SynchedPropertySimpleOneWayPU<string>;
    get authorLabel() {
        return this.__authorLabel.get();
    }
    set authorLabel(newValue: string) {
        this.__authorLabel.set(newValue);
    }
    private __feedImageUrl: SynchedPropertySimpleOneWayPU<string>;
    get feedImageUrl() {
        return this.__feedImageUrl.get();
    }
    set feedImageUrl(newValue: string) {
        this.__feedImageUrl.set(newValue);
    }
    private __caption: SynchedPropertySimpleOneWayPU<string>;
    get caption() {
        return this.__caption.get();
    }
    set caption(newValue: string) {
        this.__caption.set(newValue);
    }
    private __pictureUrl: SynchedPropertySimpleOneWayPU<string>;
    get pictureUrl() {
        return this.__pictureUrl.get();
    }
    set pictureUrl(newValue: string) {
        this.__pictureUrl.set(newValue);
    }
    private __galleryUrls: SynchedPropertySimpleOneWayPU<string[]>;
    get galleryUrls() {
        return this.__galleryUrls.get();
    }
    set galleryUrls(newValue: string[]) {
        this.__galleryUrls.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private onOpen: () => void;
    private displayAuthor(): string {
        return (this.authorLabel || this.entry.author || '').trim() || '未知来源';
    }
    private FeedAvatar(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.feedImageUrl.trim()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.feedImageUrl.trim());
                        Image.width(28);
                        Image.height(28);
                        Image.borderRadius(14);
                        Image.backgroundColor(this.theme.elevated);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Stack.create({ alignContent: Alignment.Center });
                    }, Stack);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create();
                        Row.width(28);
                        Row.height(28);
                        Row.borderRadius(14);
                        Row.backgroundColor(this.theme.accent);
                    }, Row);
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.displayAuthor().substring(0, 1).toUpperCase());
                        Text.fontSize(12);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor('#FFFFFF');
                    }, Text);
                    Text.pop();
                    Stack.pop();
                });
            }
        }, If);
        If.pop();
    }
    private normalizedGalleryUrls(): string[] {
        return selectPictureMediaUrls(this.galleryUrls);
    }
    private galleryTiles(): PictureGalleryTile[] {
        return createPictureGalleryTiles(this.normalizedGalleryUrls());
    }
    private GalleryGrid(props: PictureEntryGalleryGridProps, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Flex.create({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween });
            Flex.width('100%');
        }, Flex);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const tile = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Stack.create({ alignContent: Alignment.Center });
                    Stack.width(tile.width);
                    Stack.aspectRatio(1);
                    Stack.clip(true);
                    Stack.margin({ bottom: 6 });
                }, Stack);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Image.create(tile.url);
                    Image.width('100%');
                    Image.height('100%');
                    Image.objectFit(ImageFit.Cover);
                    Image.borderRadius(12);
                    Image.backgroundColor(this.theme.elevated);
                }, Image);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    If.create();
                    if (tile.overflowCount > 0) {
                        this.ifElseBranchUpdateFunction(0, () => {
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Row.create();
                                Row.width('100%');
                                Row.height('100%');
                                Row.borderRadius(12);
                                Row.backgroundColor('rgba(0,0,0,0.28)');
                            }, Row);
                            Row.pop();
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(`+${tile.overflowCount}`);
                                Text.fontSize(16);
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
                Stack.pop();
            };
            this.forEachUpdateFunction(elmtId, props.galleryTiles, forEachItemGenFunction, (tile: PictureGalleryTile) => `${tile.url}-${tile.overflowCount}`, false, false);
        }, ForEach);
        ForEach.pop();
        Flex.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 10 });
            Column.width('100%');
            Column.padding({ top: 8, bottom: 10 });
            Column.alignItems(HorizontalAlign.Start);
            Column.transition(livoMotion.enterSoft(this.index * 18 + 40));
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => {
                this.onOpen();
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.width('100%');
        }, Row);
        this.FeedAvatar.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.displayAuthor());
            Text.fontSize(15);
            Text.fontWeight(FontWeight.Medium);
            Text.fontColor(this.theme.textPrimary);
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
            Text.create(formatPublishedAt(this.entry.publishedAt));
            Text.fontSize(12);
            Text.fontColor(this.theme.textMuted);
        }, Text);
        Text.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.caption) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.caption);
                        Text.fontSize(13);
                        Text.lineHeight(20);
                        Text.fontColor(this.theme.textSecondary);
                        Text.maxLines(2);
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
            If.create();
            if (this.normalizedGalleryUrls().length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.GalleryGrid.bind(this)(makeBuilderParameterProxy("GalleryGrid", { galleryTiles: () => this.galleryTiles() }));
                });
            }
            else if (this.pictureUrl) {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Image.create(this.pictureUrl);
                        Image.width('100%');
                        Image.height(220);
                        Image.objectFit(ImageFit.Cover);
                        Image.borderRadius(18);
                        Image.backgroundColor(this.theme.elevated);
                    }, Image);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

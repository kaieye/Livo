if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface TweetEntryCard_Params {
    presentation?: TweetEntryPresentation;
    theme?: ThemePalette;
    onOpen?: () => void;
}
import { ThemeService } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import type { ThemePalette } from "@bundle:com.livo.harmony/entry/ets/common/services/ThemeService";
import { livoMotion } from "@bundle:com.livo.harmony/entry/ets/common/ui/Motion";
import type { TweetEntryPresentation, TweetQuotedPresentation } from '../utils/TweetEntryPresentation';
import { AvatarTile } from "@bundle:com.livo.harmony/entry/ets/common/components/AvatarTile";
export class TweetEntryCard extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__presentation = new SynchedPropertyObjectOneWayPU(params.presentation, this, "presentation");
        this.__theme = new SynchedPropertyObjectOneWayPU(params.theme, this, "theme");
        this.onOpen = () => { };
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: TweetEntryCard_Params) {
        if (params.presentation === undefined) {
            this.__presentation.set({} as TweetEntryPresentation);
        }
        if (params.theme === undefined) {
            this.__theme.set(ThemeService.darkPalette());
        }
        if (params.onOpen !== undefined) {
            this.onOpen = params.onOpen;
        }
    }
    updateStateVars(params: TweetEntryCard_Params) {
        this.__presentation.reset(params.presentation);
        this.__theme.reset(params.theme);
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__presentation.purgeDependencyOnElmtId(rmElmtId);
        this.__theme.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__presentation.aboutToBeDeleted();
        this.__theme.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __presentation: SynchedPropertySimpleOneWayPU<TweetEntryPresentation>;
    get presentation() {
        return this.__presentation.get();
    }
    set presentation(newValue: TweetEntryPresentation) {
        this.__presentation.set(newValue);
    }
    private __theme: SynchedPropertySimpleOneWayPU<ThemePalette>;
    get theme() {
        return this.__theme.get();
    }
    set theme(newValue: ThemePalette) {
        this.__theme.set(newValue);
    }
    private onOpen: () => void;
    private usernameLabel(): string {
        return (this.presentation.username || '').trim();
    }
    private retweetLabel(): string {
        return (this.presentation.retweetByLabel || '').trim();
    }
    private normalizedMediaUrls(): string[] {
        return (this.presentation.mediaUrls || [])
            .map((url: string) => url.trim())
            .filter((url: string) => !!url)
            .slice(0, 4);
    }
    private hasQuotedTweet(): boolean {
        return this.presentation.kind === 'quote' && !!this.presentation.quotedTweet;
    }
    private quotedTweet(): TweetQuotedPresentation {
        return this.presentation.quotedTweet || {
            displayName: '',
            username: '',
            avatarUrl: '',
            text: '',
            mediaUrls: [],
        };
    }
    private quotedUsernameLabel(): string {
        return (this.quotedTweet().username || '').trim();
    }
    private mediaTileWidth(index: number, count: number): string {
        if (count <= 1) {
            return '100%';
        }
        if (count === 3 && index === 0) {
            return '100%';
        }
        return '49.2%';
    }
    private mediaTileHeight(index: number, count: number): number {
        if (count <= 1) {
            return 208;
        }
        if (count === 3 && index === 0) {
            return 148;
        }
        return 136;
    }
    private RetweetBanner(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.presentation.kind === 'retweet' && this.retweetLabel()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 6 });
                        Row.width('100%');
                        Row.padding({ left: 48, bottom: 2 });
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create('转');
                        Text.fontSize(10);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textMuted);
                        Text.width(16);
                        Text.height(16);
                        Text.textAlign(TextAlign.Center);
                        Text.backgroundColor(this.theme.elevated);
                        Text.borderRadius(999);
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`${this.retweetLabel()} 已转帖`);
                        Text.fontSize(11);
                        Text.fontWeight(FontWeight.Medium);
                        Text.fontColor(this.theme.textMuted);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                    Row.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private MediaGrid(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.normalizedMediaUrls().length > 0) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Flex.create({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween });
                        Flex.width('100%');
                        Flex.clip(true);
                    }, Flex);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = (_item, index: number) => {
                            const mediaUrl = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Image.create(mediaUrl);
                                Image.width(this.mediaTileWidth(index, this.normalizedMediaUrls().length));
                                Image.height(this.mediaTileHeight(index, this.normalizedMediaUrls().length));
                                Image.borderRadius(14);
                                Image.objectFit(ImageFit.Cover);
                                Image.backgroundColor(this.theme.elevated);
                                Image.margin({ bottom: this.normalizedMediaUrls().length > 1 ? 6 : 0 });
                            }, Image);
                        };
                        this.forEachUpdateFunction(elmtId, this.normalizedMediaUrls(), forEachItemGenFunction, (mediaUrl: string, index: number) => `${mediaUrl}_${index}`, true, true);
                    }, ForEach);
                    ForEach.pop();
                    Flex.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    private QuoteCard(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.hasQuotedTweet()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Column.create({ space: 8 });
                        Column.width('100%');
                        Column.alignItems(HorizontalAlign.Start);
                        Column.padding({ left: 12, right: 12, top: 10, bottom: 10 });
                        Column.border({ width: 1, color: this.theme.divider });
                        Column.borderRadius(16);
                        Column.backgroundColor(this.theme.isDark ? '#171C22' : '#F9FBFC');
                    }, Column);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 8 });
                        Row.width('100%');
                    }, Row);
                    {
                        this.observeComponentCreation2((elmtId, isInitialRender) => {
                            if (isInitialRender) {
                                let componentCall = new AvatarTile(this, {
                                    imageUrl: this.quotedTweet().avatarUrl,
                                    fallbackLabel: this.quotedTweet().displayName,
                                    accent: this.theme.accent,
                                    theme: this.theme,
                                    avatarSize: 28,
                                    radius: 999,
                                    textSize: 11,
                                    showFallbackLabel: false,
                                }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/TweetEntryCard.ets", line: 120, col: 11 });
                                ViewPU.create(componentCall);
                                let paramsLambda = () => {
                                    return {
                                        imageUrl: this.quotedTweet().avatarUrl,
                                        fallbackLabel: this.quotedTweet().displayName,
                                        accent: this.theme.accent,
                                        theme: this.theme,
                                        avatarSize: 28,
                                        radius: 999,
                                        textSize: 11,
                                        showFallbackLabel: false
                                    };
                                };
                                componentCall.paramsGenerator_ = paramsLambda;
                            }
                            else {
                                this.updateStateVarsOfChildByElmtId(elmtId, {
                                    imageUrl: this.quotedTweet().avatarUrl,
                                    fallbackLabel: this.quotedTweet().displayName,
                                    accent: this.theme.accent,
                                    theme: this.theme,
                                    avatarSize: 28,
                                    radius: 999,
                                    textSize: 11,
                                    showFallbackLabel: false
                                });
                            }
                        }, { name: "AvatarTile" });
                    }
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Row.create({ space: 4 });
                        Row.layoutWeight(1);
                    }, Row);
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.quotedTweet().displayName || '未知来源');
                        Text.fontSize(13);
                        Text.fontWeight(FontWeight.Bold);
                        Text.fontColor(this.theme.textPrimary);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                    }, Text);
                    Text.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.quotedUsernameLabel()) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.quotedUsernameLabel());
                                    Text.fontSize(12);
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
                    Row.pop();
                    Row.pop();
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        If.create();
                        if (this.quotedTweet().text) {
                            this.ifElseBranchUpdateFunction(0, () => {
                                this.observeComponentCreation2((elmtId, isInitialRender) => {
                                    Text.create(this.quotedTweet().text);
                                    Text.fontSize(13);
                                    Text.lineHeight(20);
                                    Text.fontColor(this.theme.textPrimary);
                                    Text.maxLines(4);
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
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                });
            }
        }, If);
        If.pop();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding({ left: 14, right: 14, top: 12, bottom: 10 });
            Column.backgroundColor(this.theme.surface);
            Column.borderRadius(18);
            Column.border({ width: 0.8, color: this.theme.divider });
            Column.alignItems(HorizontalAlign.Start);
            Column.transition(livoMotion.enterSoft(24));
            Column.clickEffect({ level: ClickEffectLevel.LIGHT });
            Column.onClick(() => {
                this.onOpen();
            });
        }, Column);
        this.RetweetBanner.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 8 });
            Row.width('100%');
            Row.alignItems(VerticalAlign.Top);
        }, Row);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new AvatarTile(this, {
                        imageUrl: this.presentation.avatarUrl,
                        fallbackLabel: this.presentation.displayName,
                        accent: this.theme.accent,
                        theme: this.theme,
                        avatarSize: 17,
                        radius: 999,
                        textSize: 11,
                        showFallbackLabel: false,
                    }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/common/components/TweetEntryCard.ets", line: 174, col: 9 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            imageUrl: this.presentation.avatarUrl,
                            fallbackLabel: this.presentation.displayName,
                            accent: this.theme.accent,
                            theme: this.theme,
                            avatarSize: 17,
                            radius: 999,
                            textSize: 11,
                            showFallbackLabel: false
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        imageUrl: this.presentation.avatarUrl,
                        fallbackLabel: this.presentation.displayName,
                        accent: this.theme.accent,
                        theme: this.theme,
                        avatarSize: 17,
                        radius: 999,
                        textSize: 11,
                        showFallbackLabel: false
                    });
                }
            }, { name: "AvatarTile" });
        }
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create({ space: 4 });
            Row.layoutWeight(1);
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.presentation.displayName || '未知来源');
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor(this.theme.textPrimary);
            Text.maxLines(1);
            Text.textOverflow({ overflow: TextOverflow.Ellipsis });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.usernameLabel()) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.usernameLabel());
                        Text.fontSize(14);
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
            If.create();
            if (this.presentation.publishedLabel) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(`· ${this.presentation.publishedLabel}`);
                        Text.fontSize(13);
                        Text.fontColor(this.theme.textMuted);
                        Text.maxLines(1);
                        Text.textOverflow({ overflow: TextOverflow.Ellipsis });
                        Text.layoutWeight(1);
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
        Row.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.presentation.text) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        Text.create(this.presentation.text);
                        Text.fontSize(16);
                        Text.lineHeight(24);
                        Text.fontColor(this.theme.textPrimary);
                        Text.width('100%');
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
        this.QuoteCard.bind(this)();
        this.MediaGrid.bind(this)();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
}

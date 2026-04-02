if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface Discover_Params {
}
import { DiscoverContent } from "@bundle:com.livo.harmony/entry/ets/common/components/DiscoverContent";
import { openRootTab } from "@bundle:com.livo.harmony/entry/ets/common/navigation/AppRouter";
class Discover extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: Discover_Params) {
    }
    updateStateVars(params: Discover_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
    }
    aboutToBeDeleted() {
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    aboutToAppear(): void {
        void openRootTab('discover', true);
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Stack.create();
            Stack.width('100%');
            Stack.height('100%');
        }, Stack);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new DiscoverContent(this, { showBottomTabs: true }, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/Discover.ets", line: 13, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {
                            showBottomTabs: true
                        };
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {
                        showBottomTabs: true
                    });
                }
            }, { name: "DiscoverContent" });
        }
        Stack.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "Discover";
    }
}
registerNamedRoute(() => new Discover(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/Discover", pageFullPath: "entry/src/main/ets/pages/Discover", integratedHsp: "false", moduleType: "followWithHap" });

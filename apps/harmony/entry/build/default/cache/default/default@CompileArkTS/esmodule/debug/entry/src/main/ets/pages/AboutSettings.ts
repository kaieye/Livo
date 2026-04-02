if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface AboutSettings_Params {
}
import { AboutSettingsPanel } from "@bundle:com.livo.harmony/entry/ets/common/components/SettingsSecondaryPanels";
class AboutSettings extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: AboutSettings_Params) {
    }
    updateStateVars(params: AboutSettings_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
    }
    aboutToBeDeleted() {
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        {
            this.observeComponentCreation2((elmtId, isInitialRender) => {
                if (isInitialRender) {
                    let componentCall = new AboutSettingsPanel(this, {}, undefined, elmtId, () => { }, { page: "entry/src/main/ets/pages/AboutSettings.ets", line: 8, col: 7 });
                    ViewPU.create(componentCall);
                    let paramsLambda = () => {
                        return {};
                    };
                    componentCall.paramsGenerator_ = paramsLambda;
                }
                else {
                    this.updateStateVarsOfChildByElmtId(elmtId, {});
                }
            }, { name: "AboutSettingsPanel" });
        }
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "AboutSettings";
    }
}
registerNamedRoute(() => new AboutSettings(undefined, {}), "", { bundleName: "com.livo.harmony", moduleName: "entry", pagePath: "pages/AboutSettings", pageFullPath: "entry/src/main/ets/pages/AboutSettings", integratedHsp: "false", moduleType: "followWithHap" });

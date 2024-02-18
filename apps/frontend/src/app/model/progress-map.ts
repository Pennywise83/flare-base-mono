import { ChangeDetectorRef } from "@angular/core";

export class ProgressMap {
    private componentsMap: { [componentName: string]: number } = {};
    setProgress(componentName: string, progress: string) {
        if (!this.componentsMap[componentName]) { this.componentsMap[componentName] = 0 };
        this.componentsMap[componentName] = JSON.parse(progress).toFixed(0);
        this._cdr.detectChanges();
    }
    getProgress(componentName: string): number {
        return !this.componentsMap[componentName] ? 0 : this.componentsMap[componentName];
    }
    constructor(private _cdr: ChangeDetectorRef) { }
}
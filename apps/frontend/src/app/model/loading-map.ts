import { ChangeDetectorRef } from "@angular/core";

export class LoadingMap {
    private componentsMap: { [componentName: string]: boolean } = {};
    setLoading(componentName: string, loading: boolean) {
        if (!this.componentsMap[componentName]) { this.componentsMap[componentName] = false };
        this.componentsMap[componentName] = loading;
        this._cdr.detectChanges();
    }
    isLoading(componentName: string): boolean {
        return typeof this.componentsMap[componentName] == 'undefined' ? true : this.componentsMap[componentName];
    }
    constructor(private _cdr: ChangeDetectorRef) { }
}
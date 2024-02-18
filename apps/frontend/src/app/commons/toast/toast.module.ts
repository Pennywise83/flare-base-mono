import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgIconsModule } from '@ng-icons/core';
import { heroCheckCircleSolid, heroExclamationTriangleSolid, heroInformationCircleSolid, heroXCircleSolid } from '@ng-icons/heroicons/solid';
import { ToastComponent } from './toast.component';

@NgModule({
    declarations: [
        ToastComponent
    ],
    imports: [
        CommonModule,
        NgIconsModule.withIcons({ heroCheckCircleSolid, heroExclamationTriangleSolid, heroInformationCircleSolid, heroXCircleSolid }),

    ],
    exports: [
        ToastComponent
    ]
})
export class ToastModule { }
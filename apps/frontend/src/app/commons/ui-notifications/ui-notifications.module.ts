import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgIconsModule } from '@ng-icons/core';
import { heroCheckCircleSolid, heroExclamationTriangleSolid, heroInformationCircleSolid, heroXCircleSolid } from '@ng-icons/heroicons/solid';
import { UiNotificationsComponent } from './ui-notifications.component';

@NgModule({
    declarations: [
        UiNotificationsComponent
    ],
    imports: [
        CommonModule,
        NgIconsModule.withIcons({ heroCheckCircleSolid, heroExclamationTriangleSolid, heroInformationCircleSolid, heroXCircleSolid }),

    ],
    exports: [
        UiNotificationsComponent
    ]
})
export class UiNotificationsModule { }
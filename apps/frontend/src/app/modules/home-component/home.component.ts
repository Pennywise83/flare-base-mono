import { NgIf } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { AppModule } from "app/app.module";
import { NavigationService } from "app/services/navigation";
import { navigationDefinition } from "../../commons/navigation-definition";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Navigation } from "app/services/navigation/navigation.types";

import { NetworkEnum } from "../../../../../../libs/commons/src";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { availableChains } from "app/services/web3/model/available-chains";

@Component({
    selector: 'flare-base-home',
    imports: [AppModule, NgIf, MatButtonModule, MatIconModule, RouterModule],
    templateUrl: './home.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
    navigation: Navigation;
    network: string;
    chains: IChainDefinition[] = availableChains;
    constructor(
        private _route: ActivatedRoute,
        private _cdr: ChangeDetectorRef,
    ) {

    }
    ngOnInit(): void {
        this._route.paramMap.subscribe(params => {
            this.network = params.get('network');
            if (this.network) {
                (this.navigation as any) = {};
                this.navigation.default = navigationDefinition[this.network];
                this._cdr.detectChanges();

            }
        });
    }

}
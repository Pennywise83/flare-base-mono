import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { RouterModule } from "@angular/router";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { VotePowerHistoryRequest } from "app/model/votepower-history-request";
import { FtsoService } from "app/services/ftso.service";
import { VotePowerService } from "app/services/votepower.service";
import { saveAs } from 'file-saver';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { DataProviderInfo, NetworkEnum, RewardEpochSettings, VotePowerDTO } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { UiNotificationsService } from "../../commons/ui-notifications/ui-notifications.service";
import { DataProviderDelegationsComponent, VotePowerDelegatorsChange } from "../delegations-explorer/data-provider-delegations/data-provider-delegations.component";
import { VotePowerDelegationsChangeTableComponent } from "../delegations-explorer/data-provider-delegations/vote-power-delegations-table/vote-power-delegations-table.component";
import { VotePowerOverDelegationsChartComponent } from "../delegations-explorer/data-provider-delegations/vote-power-over-delegations-chart/vote-power-over-delegations-chart.component";

@Component({
    selector: 'flare-base-votepower-history',
    templateUrl: './votepower-history.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, LoaderComponent, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, VotePowerDelegationsChangeTableComponent, VotePowerOverDelegationsChartComponent, MatMenuModule, DatePipe, NgxMatSelectSearchModule, AddressTrimPipe],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class VotePowerHistoryComponent implements OnInit, OnChanges {
    @Input() network: NetworkEnum;
    @Input() rewardEpochSettings: RewardEpochSettings;
    @Input() request: VotePowerHistoryRequest;
    @Input() refreshTimestamp: number;
    @Input() exportCsvTimestamp: number;
    loading: boolean;
    delegatedVotePowerHistory: VotePowerDTO[] = [];
    votePowerHistoryChange: VotePowerDelegatorsChange[];
    dataProvidersInfo: DataProviderInfo[] = [];

    constructor(
        private _cdr: ChangeDetectorRef,
        private _uiNotificationsService: UiNotificationsService,
        private _ftsoService: FtsoService,
        private _votePowerService: VotePowerService,
        private _datePipe: DatePipe
    ) {
    }

    ngOnInit(): void {
        this.refreshData(this.request);

    }
    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.refreshTimestamp && !changes.refreshTimestamp.isFirstChange() && changes.refreshTimestamp.currentValue != changes.refreshTimestamp.previousValue)) {
            this.refreshData(this.request);
        }
        if ((changes.exportCsvTimestamp && !changes.exportCsvTimestamp.isFirstChange() && changes.exportCsvTimestamp.currentValue != changes.exportCsvTimestamp.previousValue)) {
            this.exportCsv();
        }
    }
    refreshData(request: VotePowerHistoryRequest): void {
        this.loading = true;
        this._cdr.detectChanges();
        this.request.pageSize = 1000;
        this._votePowerService.getDelegatedVotePowerHistory(this.network, request).subscribe(votePowerHistory => {
            this.delegatedVotePowerHistory = votePowerHistory.results;
            this.votePowerHistoryChange = [];
            if (votePowerHistory.results.length > 1) {
                this.votePowerHistoryChange = DataProviderDelegationsComponent.getVotePowerAndDelegatorsChange(votePowerHistory.results, votePowerHistory.results.length - 1, this.rewardEpochSettings);
                this._cdr.detectChanges();
            }
        }, votePowerHistoryErr => {
            this._uiNotificationsService.error('Unable to fetch vote power history', votePowerHistoryErr);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }
    exportCsv(): void {
        this.loading = true;
        let startTime: string = this._datePipe.transform(this.request.startTime, 'YYYY-MM-dd _HH-mm-ss');
        let endTime: string = this._datePipe.transform(this.request.endTime, 'YYYY-MM-dd_HH-mm-ss');
        this._votePowerService.getDelegatedVotePowerHistoryCsv(this.network, this.request).subscribe(delegations => {
            saveAs(delegations, `${this.network}-VotePowerHistory-address_${this.request.address ? this.request.address : 'total'}-startTime_${startTime}-endTime_${endTime}.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export data provider delegations data', statsErr);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }
}
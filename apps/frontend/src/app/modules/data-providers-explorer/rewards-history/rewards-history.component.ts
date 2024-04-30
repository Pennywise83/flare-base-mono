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
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { RewardsHistoryRequest } from "app/model/rewards-history-request";
import { VotePowerDelegationsChangeTableComponent } from "app/modules/delegations-explorer/data-provider-delegations/vote-power-delegations-table/vote-power-delegations-table.component";
import { VotePowerOverDelegationsChartComponent } from "app/modules/delegations-explorer/data-provider-delegations/vote-power-over-delegations-chart/vote-power-over-delegations-chart.component";
import { FtsoService } from "app/services/ftso.service";
import { saveAs } from 'file-saver';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { DataProviderInfo, NetworkEnum, RewardEpochSettings, SortOrderEnum } from "../../../../../../../libs/commons/src";
import { DataProviderRewardStatsDTO } from "./model/data-provider-reward-stats-dto";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { RewardsHistoryTableComponent } from "../rewards-history-table/rewards-history-table.component";
import { RewardsHistoryChartComponent } from "../rewards-history-chart/rewards-history-chart.component";

@Component({
    selector: 'flare-base-rewards-history',
    templateUrl: './rewards-history.component.html',
    imports: [AppModule, MatIconModule, RouterModule, FormsModule, LoaderComponent, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, VotePowerDelegationsChangeTableComponent, VotePowerOverDelegationsChartComponent, MatMenuModule, DatePipe, NgxMatSelectSearchModule, AddressTrimPipe, RewardsHistoryTableComponent, RewardsHistoryChartComponent],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class RewardsHistoryComponent implements OnInit, OnChanges {
    @Input() network: NetworkEnum;
    @Input() rewardEpochSettings: RewardEpochSettings;
    @Input() request: RewardsHistoryRequest;
    @Input() refreshTimestamp: number;
    @Input() dataProvidersInfo: DataProviderInfo[] = [];
    loading: boolean;
    rewardHistory: DataProviderRewardStatsDTO[] = [];
    rewardsHistoryChange: RewardsHistoryChange[];
    sortOrder = SortOrderEnum;


    constructor(
        private _cdr: ChangeDetectorRef,
        private _ftsoService: FtsoService,
        private _uiNotificationsService: UiNotificationsService,
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
            // this.exportCsv();
        }
    }
    refreshData(request: RewardsHistoryRequest): void {
        this.loading = true;
        this._cdr.detectChanges();
        this.request.pageSize = 1000;
        this._ftsoService.getDataProviderRewardStatsHistory(this.network, this.rewardEpochSettings, request).subscribe(rewardStats => {
            this.rewardHistory = rewardStats.results;
            this.rewardsHistoryChange = [];
            if (rewardStats.results.length > 1) {
                this.rewardsHistoryChange = this.getRewardsHistoryChange(rewardStats.results, rewardStats.results.length - 1, this.rewardEpochSettings);
                this._cdr.detectChanges();
            }
            this._cdr.detectChanges();
        }, votePowerHistoryErr => {
            this._uiNotificationsService.error('Unable to fetch Ftso rewards history', votePowerHistoryErr);
        }).add(() => {
            this.loading = false;
            this._cdr.detectChanges();
        });
    }
    getRewardsHistoryChange(rewardStats: DataProviderRewardStatsDTO[], size: number, rewardEpochSettings: RewardEpochSettings): RewardsHistoryChange[] {
        let results: RewardsHistoryChange[] = [];
        rewardStats.sort((a, b) => b.epochId - a.epochId).map((rewardsStat, idx) => {
            if (idx < size) {
                let tmpObj: RewardsHistoryChange = new RewardsHistoryChange();
                tmpObj.rewardEpoch = rewardsStat.epochId;
                tmpObj.rewardEpochEndTime = rewardEpochSettings.getEndTimeForEpochId(rewardsStat.epochId);
                tmpObj.rewardEpochStartTime = rewardEpochSettings.getStartTimeForEpochId(rewardsStat.epochId);
                tmpObj.delegatorRewards = rewardsStat.delegatorsReward;
                tmpObj.providerRewards = rewardsStat.providerReward;
                tmpObj.rewardRate = rewardsStat.rewardRate;
                tmpObj.delegatorRewardsChange = (((rewardsStat.delegatorsReward * 100) / rewardStats[idx + 1].delegatorsReward) - 100);
                tmpObj.providerRewardsChange = (((rewardsStat.providerReward * 100) / rewardStats[idx + 1].providerReward) - 100);
                tmpObj.rewardRateChange = (((rewardsStat.rewardRate * 100) / rewardStats[idx + 1].rewardRate) - 100);
                results.push(tmpObj);
            }
        });
        return results;
    }
}


export class RewardsHistoryChange {
    rewardEpoch: number;
    rewardEpochStartTime: number;
    rewardEpochEndTime: number;
    providerRewards: number;
    providerRewardsChange: number;
    delegatorRewards: number;
    delegatorRewardsChange: number;
    rewardRate: number;
    rewardRateChange: number;
}
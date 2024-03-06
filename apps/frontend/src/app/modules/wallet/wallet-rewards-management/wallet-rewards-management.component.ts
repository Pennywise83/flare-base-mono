import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { AppModule } from "app/app.module";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { Utils } from "app/commons/utils";
import { ClaimedRewardsHistogramRequest, ClaimedRewardsRequest } from "app/model/claimed-rewards-request";
import { LoadingMap } from "app/model/loading-map";
import { TimeRange, TimeRangeDefinition } from "app/model/time-range";
import { ClaimedRewardsChartComponent } from "app/modules/claimed-rewards-chart/claimed-rewards-chart.component";
import { ClaimedRewardsTableComponent } from "app/modules/claimed-rewards-table/claimed-rewards-table.component";
import { FtsoService } from "app/services/ftso.service";
import { RewardsService } from "app/services/rewards.service";
import { availableChains } from "app/services/web3/model/available-chains";
import { IChainDefinition } from "app/services/web3/model/i-chain-definition";
import { Web3Service } from "app/services/web3/web3.service";
import { isEmpty } from "class-validator";
import { saveAs } from 'file-saver';
import { Subject, takeUntil } from "rxjs";
import { ClaimedRewardHistogramElement, ClaimedRewardsGroupByEnum, DataProviderInfo, NetworkEnum, PaginatedResult, RewardDTO } from "../../../../../../../libs/commons/src";
import { WalletDelegationsRewardsComponent } from "../wallet-claimed-rewards/wallet-delegations-rewards.component";

@Component({
    selector: 'flare-base-wallet-rewards-management',
    imports: [AppModule, WalletDelegationsRewardsComponent, ClaimedRewardsTableComponent, NoDataComponent, LoaderComponent, MatFormFieldModule, MatMenuModule, FormsModule, MatButtonModule, MatInputModule, ClaimedRewardsChartComponent],
    providers: [DatePipe],
    templateUrl: './wallet-rewards-management.component.html',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletRewardsManagementComponent implements OnInit {
    private _parentParams: { [param: string]: string };
    public network: NetworkEnum;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    public isWeb3ClientInstalled: boolean = false;
    public isSmartContractsInitialized: boolean = false;
    public isClientConnected: boolean;
    public selectedAddress: string;
    public selectedChainId: number;
    public selectedChain: IChainDefinition;
    public loadingMap: LoadingMap;
    public claimedRewards: PaginatedResult<RewardDTO[]>;
    public dataProvidersInfo: DataProviderInfo[] = [];
    tableColumns: string[] = ['timestamp', 'rewardEpoch', 'dataProvider', 'sentTo', 'amount'];
    public tableRequest: ClaimedRewardsRequest;
    selectedTimeRangeDefinition: TimeRangeDefinition;
    timeRanges: TimeRangeDefinition[] = [
        new TimeRangeDefinition('lastMonth', 'Last month', (60 * 60 * 24 * 30) * 1000),
        new TimeRangeDefinition('last3Months', 'Last 3 months', ((60 * 60 * 24 * 30) * 3) * 1000),
        new TimeRangeDefinition('last6Months', 'Last 6 months', ((60 * 60 * 24 * 30) * 6) * 1000),
        new TimeRangeDefinition('lastYear', 'Last year', ((60 * 60 * 24 * 30) * 12) * 1000),
        new TimeRangeDefinition('last2Years', 'Last 2 years', ((60 * 60 * 24 * 30) * 12) * 2 * 1000)
    ];
    histogramGroupBy: ClaimedRewardsGroupByEnum = ClaimedRewardsGroupByEnum.rewardEpochId;
    claimedRewardsDateHistogramData: ClaimedRewardHistogramElement[];
    constructor(
        private _cdr: ChangeDetectorRef,
        private _route: ActivatedRoute,
        private _router: Router,
        private _uiNotificationsService: UiNotificationsService,
        private _web3Service: Web3Service,
        private _rewardsService: RewardsService,
        private _datePipe: DatePipe,
        private _ftsoService: FtsoService,
        private _titleService: Title
    ) {
        this.loadingMap = new LoadingMap(this._cdr);
    }
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
    ngOnInit(): void {
        this.tableRequest = new ClaimedRewardsRequest(null, null, null, null);
        this.selectedTimeRangeDefinition = this.timeRanges[0];

        Utils.getParentParams(this._route).pipe(
            takeUntil(this._unsubscribeAll))
            .subscribe(params => {
                this._parentParams = { ...this._parentParams, ...params };
                if (isEmpty(this._parentParams['network'])) {
                    this._uiNotificationsService.error(`Unable to initialize component`, `Invalid parameters`);
                    return;
                }
                if (this._parentParams['network'] != this.network) {
                    this.network = NetworkEnum[this._parentParams['network']];
                    this._titleService.setTitle(`Flare Base - ${this.network} - Wallet Delegations management`);
                }
                this._web3Service.checkMetamaskProvider().subscribe(web3ClientInstalled => {
                    this.isWeb3ClientInstalled = web3ClientInstalled;
                    if (this.isWeb3ClientInstalled) {
                        this._web3Service.checkIfIsConnected().subscribe(clientConnected => {
                            this.isClientConnected = clientConnected;
                            this.isSmartContractsInitialized = this._web3Service.isContractsInitialized();
                            this.selectedChainId = this._web3Service.getConnectedChain();
                            this.selectedChain = availableChains.find(chain => chain.chainId == this.selectedChainId);
                            this.selectedAddress = this._web3Service.getConnectedAddress();
                            if (this.isWalletConnected()) {
                                this.tableRequest = new ClaimedRewardsRequest(this.selectedAddress, null, this.selectedTimeRangeDefinition.getTimeRange().start, this.selectedTimeRangeDefinition.getTimeRange().end);
                                this.tableRequest.pageSize = 10;
                                this._web3Service.fetchBalances(this.selectedAddress).subscribe();
                                this._web3Service.fetchDelegatesOf(this.selectedAddress).subscribe();
                                this.refreshTableData();
                                this.refreshChartData(this.tableRequest);
                            }
                        }, clientErr => {
                            this._uiNotificationsService.error(`Unable to check if Web3 Client is connected`, clientErr, 10_000);
                            return;
                        });
                    }
                }, web3ClientInstalledErr => {
                    this._uiNotificationsService.error(`Unable to check Web3 Client availability`, web3ClientInstalledErr);
                    return;
                });
            });
    }
    isWalletConnected(): boolean {
        return (this.isClientConnected && this.selectedChainId != null && this.isSmartContractsInitialized && typeof this.selectedAddress != 'undefined' && this.selectedAddress != null);
    }
    setHistogramGroupBy(groupBy: ClaimedRewardsGroupByEnum): void {
        this.histogramGroupBy = groupBy;
        let currentParams = { ...this._route.snapshot.queryParams };
        currentParams.groupBy = this.histogramGroupBy;
        this.refreshChartData(this.tableRequest);
    }
    refreshChartData(request: ClaimedRewardsRequest): void {
        this.loadingMap.setLoading('chartData', true);
        let chartRequest: ClaimedRewardsHistogramRequest = new ClaimedRewardsHistogramRequest(request.whoClaimed, request.dataProvider, request.startTime, request.endTime, this.histogramGroupBy);
        this._cdr.detectChanges();
        this._ftsoService.getDataProvidersInfo(this.network).subscribe(dataProvidersInfoRes => {
            this.dataProvidersInfo = dataProvidersInfoRes;
            this._rewardsService.getClaimedRewardsgetClaimedRewardsDateHistogram(this.network, chartRequest).subscribe(claimedRewardsRes => {
                this.claimedRewardsDateHistogramData = claimedRewardsRes;
            }, claimedRewardsErr => {
                this._uiNotificationsService.error('Unable to get claimed rewards date histogram with provided search', claimedRewardsErr);
            }).add(() => {
                this.loadingMap.setLoading('chartData', false);
            });
        });
    }
    refreshTableData(): void {
        this.loadingMap.setLoading('tableData', true);
        this.claimedRewards = null;
        this._ftsoService.getDataProvidersInfo(this.network).subscribe(dataProvidersInfoRes => {
            this.dataProvidersInfo = dataProvidersInfoRes;
            this._rewardsService.getClaimedRewards(this.network, this.tableRequest).subscribe(latestRewards => {
                this.claimedRewards = latestRewards;
            }, latestDelegationsErr => {
                this._uiNotificationsService.error('Unable to fetch claimed rewards', latestDelegationsErr);
            }).add(() => {
                this.loadingMap.setLoading('tableData', false);
                this._cdr.detectChanges();
            });
        });
    }

    selectWhoClaimed(whoClaimed: { value: string, targetRoute: string[] }): void {
        if (whoClaimed.targetRoute.includes('delegations')) {
            this._router.navigate([this.network, ...whoClaimed.targetRoute], { queryParams: { from: whoClaimed.value } });
        } else {
            this.tableRequest.whoClaimed = whoClaimed.value;
            this.tableRequest.dataProvider = null;
            this.tableRequest.sentTo = null;
            this.tableRequest.page = 1;
            this.refreshTableData();
        }
    }

    selectReceiver(sentTo: { value: string, targetRoute: string[] }): void {
        if (sentTo.targetRoute.includes('delegations')) {
            this._router.navigate([this.network, ...sentTo.targetRoute], { queryParams: { from: sentTo.value } });
        } else if (sentTo.targetRoute.includes('rewards')) {
            this._router.navigate([this.network, ...sentTo.targetRoute], { queryParams: { sentTo: sentTo.value } });
        }
    }

    selectDataProvider(dataProvider: { value: string, targetRoute: string[] }): void {
        if (dataProvider.targetRoute.includes('delegations')) {
            if (dataProvider.targetRoute.includes('explorer')) {
                this._router.navigate([this.network, ...dataProvider.targetRoute]);
            } else if (dataProvider.targetRoute.includes('search')) {
                this._router.navigate([this.network, ...dataProvider.targetRoute], { queryParams: { to: dataProvider.value } });
            }
        } else if (dataProvider.targetRoute.includes('rewards')) {
            this._router.navigate([this.network, ...dataProvider.targetRoute], { queryParams: { dataProvider: dataProvider.value } });
        }
    }
    setTimeRange(timeRangeDefinition: TimeRangeDefinition): void {
        this.selectedTimeRangeDefinition = timeRangeDefinition;
        const timeRange: TimeRange = timeRangeDefinition.getTimeRange();
        this.tableRequest.startTime = timeRange.start;
        this.tableRequest.endTime = timeRange.end;
        this.refreshTableData();
    }
    exportCsv(): void {
        this.loadingMap.setLoading('tableData', true);
        let startTime: string = this._datePipe.transform(this.tableRequest.startTime, 'YYYY-MM-dd _HH-mm-ss');
        let endTime: string = this._datePipe.transform(this.tableRequest.endTime, 'YYYY-MM-dd_HH-mm-ss');
        this._rewardsService.getClaimedRewardsCsv(this.network, this.tableRequest).subscribe(claimedRewards => {
            saveAs(claimedRewards, `${this.network}-ClaimedRewards-whoClaimed_${this.tableRequest.whoClaimed ? this.tableRequest.whoClaimed : 'all'}-dataProvider_${this.tableRequest.dataProvider ? this.tableRequest.dataProvider : 'all'}-sentTo_${this.tableRequest.sentTo ? this.tableRequest.sentTo : 'all'}-startTime_${startTime}-endTime_${endTime}.csv`);
        }, statsErr => {
            this._uiNotificationsService.error('Unable to export data provider delegations data', statsErr);
        }).add(() => {
            this.loadingMap.setLoading('tableData', false);
            this._cdr.detectChanges();
        });
    }
    handleRequestEvent(requestEvent: ClaimedRewardsRequest): void {
        this.tableRequest.page = requestEvent.page;
        this.tableRequest.pageSize = requestEvent.pageSize;
        this.tableRequest.sortField = requestEvent.sortField;
        this.tableRequest.sortOrder = requestEvent.sortOrder;
        this.refreshTableData();
    }
}
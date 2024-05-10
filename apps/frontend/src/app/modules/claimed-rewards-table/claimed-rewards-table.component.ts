import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { isEmpty, isNotEmpty } from "class-validator";

import { MatButtonModule } from "@angular/material/button";
import { SatPopoverModule } from '@ncstate/sat-popover';
import { ClaimedRewardsRequest } from "app/model/claimed-rewards-request";
import { JazziconModule } from 'ngx-jazzicon';
import { DataProviderInfo, DelegationsSortEnum, NetworkEnum, PaginatedResult, RewardDTO, SortOrderEnum } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { NoDataComponent } from "../../commons/no-data/no-data.component";
import { AddressTrimPipe } from "../../commons/pipes/address-trim.pipe";
import { Utils } from "app/commons/utils";
@Component({
    selector: 'flare-base-claimed-rewards-table',
    templateUrl: './claimed-rewards-table.component.html',
    styles: [`flare-base-claimed-rewards-table {
        display: contents;
    }`],
    imports: [AppModule, MatIconModule, MatTableModule, MatSortModule, MatPaginatorModule, MatTooltipModule, LoaderComponent, NoDataComponent, AddressTrimPipe, SatPopoverModule, JazziconModule, MatButtonModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class ClaimedRewardsTableComponent implements OnInit, OnChanges {
    @Input() loading: boolean;
    @Input() progress: number;
    @Input() network: NetworkEnum;
    @Input() request: ClaimedRewardsRequest = new ClaimedRewardsRequest(null, null, null, null);
    @Output() requestEvent: EventEmitter<ClaimedRewardsRequest> = new EventEmitter<ClaimedRewardsRequest>();
    @Output() whoClaimedSelected: EventEmitter<{ value: string, targetRoute: string[] }> = new EventEmitter<{ value: string, targetRoute: string[] }>();
    @Output() sentToSelected: EventEmitter<{ value: string, targetRoute: string[] }> = new EventEmitter<{ value: string, targetRoute: string[] }>();
    @Output() dataProviderSelected: EventEmitter<{ value: string, targetRoute: string[] }> = new EventEmitter<{ value: string, targetRoute: string[] }>();
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() claimedRewardsData: PaginatedResult<RewardDTO[]>;
    @Input() updateTable: boolean;
    @Input() dataProvidersInfo: DataProviderInfo[];
    @Input() refreshTable: boolean;
    @Input() showTopPaginator: boolean;
    @Input() paginatorPosition: 'left' | 'right';
    dataSource: MatTableDataSource<any> = new MatTableDataSource();

    @ViewChild('claimedRewardsPaginator') paginator: MatPaginator;
    @ViewChild('claimedRewardsTableSort') public claimedRewardsTableSort: MatSort;

    @Input() dynamicData: boolean = false;
    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    symbol: string;
    @Input() convertedSymbol: string;

    constructor(
        private _cdr: ChangeDetectorRef
    ) {
    }

    selectDataProvider(address: string, targetRoute: string[]): void {
        this.dataProviderSelected.emit({ value: address, targetRoute: targetRoute });
    }
    selectWhoClaimed(address: string, targetRoute: string[]): void {
        this.whoClaimedSelected.emit({ value: address, targetRoute: targetRoute });
    }
    selectSentTo(address: string, targetRoute: string[]): void {
        this.sentToSelected.emit({ value: address, targetRoute: targetRoute });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || (changes.refreshTable)) {
            this.symbol = Utils.getChainDefinition(this.network).nativeCurrency.symbol;
            if (!this.dataProvidersInfo) { this.dataProvidersInfo = [] }
            if (this.dataProvidersInfo && this.claimedRewardsData && this.claimedRewardsData.results) {
                this.claimedRewardsData.results.map(claimedReward => {
                    let correspondingInfo = this.dataProvidersInfo.find(info => info.address === claimedReward.dataProvider);
                    if (correspondingInfo) {
                        (claimedReward as any).name = correspondingInfo.name;
                        (claimedReward as any).icon = correspondingInfo.icon;
                    } else {
                        (claimedReward as any).name = 'Unknown provider';
                        (claimedReward as any).icon = 'assets/images/unknown.png';
                    }
                });
                this.dataSource.data = this.claimedRewardsData.results;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();

                if (!this.dynamicData) {
                    this.dataSource.sort = this.claimedRewardsTableSort;
                    this.dataSource.paginator = this.paginator;
                    this._cdr.detectChanges();
                }
                if (this.claimedRewardsTableSort && isNotEmpty(this.sortOnColumn) && isEmpty(this.claimedRewardsTableSort.active)) {
                    this.claimedRewardsTableSort.active = this.sortOnColumn;
                    this.claimedRewardsTableSort.direction = this.sortOrder;
                    this.dataSource.sort = this.claimedRewardsTableSort;
                    this.dataSource._updateChangeSubscription();
                    this._cdr.detectChanges();
                }
            }
        }
    }

    ngOnInit(): void {
    }


    delegationsSortChange(sortEvent: Sort): void {
        if (this.dynamicData) {
            if (isNotEmpty(sortEvent)) {
                this.request.sortField = DelegationsSortEnum[sortEvent.active == 'rewardEpoch' ? 'timestamp' : sortEvent.active];
                this.sortOnColumn = sortEvent.active;
                this.request.sortOrder = SortOrderEnum[sortEvent.direction];
                this.sortOrder = SortOrderEnum[sortEvent.direction];
                this.requestEvent.emit(this.request);
            }
        }
    }
    claimedRewardsPageChange(pageEvent?: PageEvent): void {
        if (this.dynamicData) {
            if (isNotEmpty(pageEvent)) {
                this.request.page = pageEvent.pageIndex + 1;
                this.request.pageSize = pageEvent.pageSize;
                this.requestEvent.emit(this.request);
            }
        }
    }
    public getSeed(input: string): number {
        return Number(input) / 10000000000000000000000000000000;
    }
}



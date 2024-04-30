import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { Utils } from "app/commons/utils";
import { FeedsRequest } from "app/model/feeds-request";
import { isEmpty } from "class-validator";
import { DataProviderInfo, NetworkEnum, RewardDistributed, SortOrderEnum } from "../../../../../../../libs/commons/src";

@Component({
    selector: 'flare-base-data-providers-distributed-rewards-table',
    templateUrl: './data-providers-distributed-rewards-table.component.html',
    styles: [`flare-base-vote-power-delegations-table {
        display: contents;
    }`],
    imports: [AppModule, MatIconModule, MatTableModule, MatSortModule, MatPaginatorModule, MatTooltipModule, LoaderComponent, NoDataComponent, AddressTrimPipe, MatButtonModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProvidersDistributedRewardsTableComponent implements OnInit, OnChanges {
    @Input() network: NetworkEnum;
    @Input() loading: boolean;
    @Input() progress: number;
    @Input() request: FeedsRequest = new FeedsRequest(null, null, null);
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() updateTable: boolean;
    @Input() dataProvidersInfo: DataProviderInfo[];
    @Input() dataProvidersInfoMap: Record<string, DataProviderInfo>;
    @Input() distributedRewards: RewardDistributed[];
    @Input() refreshTable: boolean;
    @Input() paginatorPosition: 'left' | 'right';
    dataSource: MatTableDataSource<any> = new MatTableDataSource();
    @ViewChild('tablePaginatior') paginator: MatPaginator;
    @ViewChild('tableSort') public distributedRewardsTableSort: MatSort;
    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    symbol: string;
    constructor(
        private _cdr: ChangeDetectorRef,
    ) {
    }


    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || changes.distributedRewards) {
            this.symbol = Utils.getChainDefinition(this.network).nativeCurrency.symbol;
            this.dataSource.data = this.distributedRewards;
            this.dataSource._updateChangeSubscription();

            this._cdr.detectChanges();
            if (this.distributedRewardsTableSort && isEmpty(this.distributedRewardsTableSort.active)) {
                this.distributedRewardsTableSort.active = this.sortOnColumn;
                this.distributedRewardsTableSort.direction = this.sortOrder;
                this.dataSource.sort = this.distributedRewardsTableSort;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();
            }
            if (this.paginator) {
                this.dataSource.sort = this.distributedRewardsTableSort;
                this.dataSource.paginator = this.paginator;
                this._cdr.detectChanges();
            }
        }
    }

    ngOnInit(): void {

    }
}



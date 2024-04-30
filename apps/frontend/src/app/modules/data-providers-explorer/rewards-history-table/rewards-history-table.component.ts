import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
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
import { RewardsHistoryRequest } from "app/model/rewards-history-request";
import { isEmpty, isNotEmpty } from "class-validator";
import { DataProviderInfo, SortOrderEnum } from "../../../../../../../libs/commons/src";
import { RewardsHistoryChange } from "../rewards-history/rewards-history.component";

@Component({
    selector: 'flare-base-rewards-history-table',
    templateUrl: './rewards-history-table.component.html',
    styles: [`flare-base-vote-power-delegations-table {
        display: contents;
    }`],
    imports: [AppModule, MatIconModule, MatTableModule, MatSortModule, MatPaginatorModule, MatTooltipModule, LoaderComponent, NoDataComponent, AddressTrimPipe],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class RewardsHistoryTableComponent implements OnInit, OnChanges {
    @Input() loading: boolean;
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() rewardsHistoryChange: RewardsHistoryChange[];
    @Input() dataProvidersInfo: DataProviderInfo[];
    dataSource: MatTableDataSource<any> = new MatTableDataSource();    
    @ViewChild('tablePaginatior') paginator: MatPaginator;
    @ViewChild('tableSort') public tableSort: MatSort;

    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    constructor(
        private _cdr: ChangeDetectorRef,
    ) {
    }


    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || changes.rewardsHistoryChange) {
            if (changes.rewardsHistoryChange) {
                this.rewardsHistoryChange = changes.rewardsHistoryChange.currentValue;
            }
            this.dataSource.data = this.rewardsHistoryChange;
            this.dataSource._updateChangeSubscription();
            this._cdr.detectChanges();


            this._cdr.detectChanges();
            if (this.tableSort && isEmpty(this.tableSort.active)) {
                this.tableSort.active = this.sortOnColumn;
                this.tableSort.direction = this.sortOrder;
                this.dataSource.sort = this.tableSort;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();
            } else {
                this.dataSource.sort = this.tableSort;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();
            }
            if (this.paginator) {
                this.dataSource.sort = this.tableSort;
                this.dataSource.paginator = this.paginator;
                this._cdr.detectChanges();
            }
        }
    }

    ngOnInit(): void {

    }
}



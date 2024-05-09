import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AppModule } from "app/app.module";
import { animations } from "app/commons/animations";
import { LoaderComponent } from "app/commons/loader/loader.component";
import { NoDataComponent } from "app/commons/no-data/no-data.component";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { FeedsRequest } from "app/model/feeds-request";
import { isEmpty, isNotEmpty } from "class-validator";
import { DataProviderInfo, SortOrderEnum } from "../../../../../../../libs/commons/src";
import { DataProviderSubmissionStats } from "../../../../../../../libs/commons/src/model/ftso/data-provider-submission-stats";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: 'flare-base-data-providers-submission-stats-table',
    templateUrl: './data-providers-submission-stats-table.component.html',
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
export class DataProvidersSubmissionStatsTableComponent implements OnInit, OnChanges {
    @Input() loading: boolean;
    @Input() progress: number;
    @Input() request: FeedsRequest = new FeedsRequest(null, null, null);
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() updateTable: boolean;
    @Input() dataProvidersInfo: DataProviderInfo[];
    @Input() dataProvidersInfoMap: Record<string, DataProviderInfo>;
    @Input() submissionStats: DataProviderSubmissionStats[];
    @Input() refreshTable: boolean;
    @Input() availableSymbols: string[];
    @Input() selectedSymbol: string;
    dataSource: MatTableDataSource<any> = new MatTableDataSource();

    @ViewChild('tablePaginatior') paginator: MatPaginator;
    @ViewChild('tableSort') public submissionStatsTableSort: MatSort;

    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    constructor(
        private _cdr: ChangeDetectorRef,
    ) {
    }


    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || changes.submissionStats || changes.selectedSymbol) {
            if (this.submissionStats) {
                let dataProviders: string[] = Array.from(new Set(this.submissionStats.map(stat => stat.dataProvider)));
                if (dataProviders.length > 1) {
                    this.dataSource.data = this.submissionStats.filter(stat => stat.symbol == this.selectedSymbol);
                } else {
                    this.dataSource.data = this.submissionStats;
                }

                this.dataSource._updateChangeSubscription();

                this._cdr.detectChanges();
                if (this.submissionStatsTableSort && isEmpty(this.submissionStatsTableSort.active)) {
                    this.submissionStatsTableSort.active = this.sortOnColumn;
                    this.submissionStatsTableSort.direction = this.sortOrder;
                    this.dataSource.sort = this.submissionStatsTableSort;
                    this.dataSource._updateChangeSubscription();
                    this._cdr.detectChanges();
                } else {
                    this.dataSource.sort = this.submissionStatsTableSort;
                    this.dataSource._updateChangeSubscription();
                    this._cdr.detectChanges();
                }
                if (this.paginator) {
                    this.dataSource.sort = this.submissionStatsTableSort;
                    this.dataSource.paginator = this.paginator;
                    this._cdr.detectChanges();
                }
            }
        }
    }

    ngOnInit(): void {

    }
}



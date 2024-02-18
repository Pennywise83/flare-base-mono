import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { isEmpty, isNotEmpty } from "class-validator";
import { DataProviderInfo, DelegationDTO, DelegationsSortEnum, PaginatedResult, SortOrderEnum } from "../../../../../../../../libs/commons/src";
import { AppModule } from "../../../../app.module";
import { animations } from "../../../../commons/animations";
import { LoaderComponent } from "../../../../commons/loader/loader.component";
import { NoDataComponent } from "../../../../commons/no-data/no-data.component";
import { AddressTrimPipe } from "../../../../commons/pipes/address-trim.pipe";
import { DelegatorsRequest } from "../../../../model/delegators-request";
import { VotePowerDelegatorsChange } from "../data-provider-delegations.component";

@Component({
    selector: 'flare-base-vote-power-delegations-table',
    templateUrl: './vote-power-delegations-table.component.html',
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
export class VotePowerDelegationsChangeTableComponent implements OnInit, OnChanges {
    @Input() loading: boolean;
    @Input() progress: number;
    @Input() request: DelegatorsRequest = new DelegatorsRequest(null, null);
    @Output() requestEvent: EventEmitter<DelegatorsRequest> = new EventEmitter<DelegatorsRequest>();
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() votePowerHistoryChange: VotePowerDelegatorsChange[];
    @Input() updateTable: boolean;
    @Input() dataProvidersInfo: DataProviderInfo[];
    @Input() refreshTable: boolean;
    dataSource: MatTableDataSource<any> = new MatTableDataSource();

    @ViewChild('tablePaginatior') paginator: MatPaginator;
    @ViewChild('tableSort') public delegationsTableSort: MatSort;

    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    constructor(
        private _cdr: ChangeDetectorRef,
    ) {
    }


    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || changes.votePowerHistoryChange) {
            if (changes.votePowerHistoryChange) {
                this.votePowerHistoryChange = changes.votePowerHistoryChange.currentValue;
            }
            this.dataSource.data = this.votePowerHistoryChange;
            this.dataSource._updateChangeSubscription();
            this._cdr.detectChanges();


            this._cdr.detectChanges();
            if (this.delegationsTableSort && isNotEmpty(this.sortOnColumn) && isEmpty(this.delegationsTableSort.active)) {
                this.delegationsTableSort.active = this.sortOnColumn;
                this.delegationsTableSort.direction = this.sortOrder;
                this.dataSource.sort = this.delegationsTableSort;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();
            }
            if (this.paginator) {
                this.dataSource.sort = this.delegationsTableSort;
                this.dataSource.paginator = this.paginator;
                this._cdr.detectChanges();
            }
        }
    }

    ngOnInit(): void {

    }
}



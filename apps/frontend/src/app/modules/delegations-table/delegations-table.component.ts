import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { UiNotificationsService } from "app/commons/ui-notifications/ui-notifications.service";
import { DelegationsRequest } from "app/model/delegations-request";
import { isEmpty, isNotEmpty } from "class-validator";

import { DataProviderInfo, DelegationDTO, DelegationsSortEnum, PaginatedResult, SortOrderEnum } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { NoDataComponent } from "../../commons/no-data/no-data.component";
import { AddressTrimPipe } from "../../commons/pipes/address-trim.pipe";
import { DelegatorsRequest } from "../../model/delegators-request";
import { SatPopoverModule } from '@ncstate/sat-popover';
import { JazziconModule } from 'ngx-jazzicon';
import { MatButtonModule } from "@angular/material/button";
@Component({
    selector: 'flare-base-delegations-table',
    templateUrl: './delegations-table.component.html',
    styles: [`flare-base-delegations-table {
        display: contents;
    }`],
    imports: [AppModule, MatIconModule, MatTableModule, MatSortModule, MatPaginatorModule, MatTooltipModule, LoaderComponent, NoDataComponent, AddressTrimPipe, SatPopoverModule, JazziconModule, MatButtonModule],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DelegationsTableComponent implements OnInit, OnChanges {
    @Input() loading: boolean;
    @Input() progress: number;
    @Input() request: DelegatorsRequest | DelegationsRequest = new DelegatorsRequest(null, null);
    @Output() requestEvent: EventEmitter<DelegatorsRequest> = new EventEmitter<DelegatorsRequest>();
    @Output() delegatorSelected: EventEmitter<{ value: string, targetRoute: string[] }> = new EventEmitter<{ value: string, targetRoute: string[] }>();
    @Output() dataProviderSelected: EventEmitter<{ value: string, targetRoute: string[] }> = new EventEmitter<{ value: string, targetRoute: string[] }>();
    @Input() tableColumns: string[] = [];
    @Input() sortOnColumn: string;
    @Input() sortOrder: SortOrderEnum = SortOrderEnum.desc;
    @Input() delegationsData: PaginatedResult<DelegationDTO[]>;
    @Input() updateTable: boolean;
    @Input() dataProvidersInfo: DataProviderInfo[];
    @Input() refreshTable: boolean;
    @Input() showTopPaginator: boolean;
    @Input() paginatorPosition: 'left' | 'right';
    dataSource: MatTableDataSource<any> = new MatTableDataSource();

    @ViewChild('delegationsPaginator') paginator: MatPaginator;
    @ViewChild('delegationsTableSort') public delegationsTableSort: MatSort;

    @Input() dynamicData: boolean = false;
    @Input() pageSize: number;
    @Input() hidePageSize: boolean = false;
    constructor(
        private _cdr: ChangeDetectorRef
    ) {
    }

    selectDataProvider(address: string, targetRoute: string[]): void {
        this.dataProviderSelected.emit({ value: address, targetRoute: targetRoute });
    }
    selectDelegator(address: string, targetRoute: string[]): void {
        this.delegatorSelected.emit({ value: address, targetRoute: targetRoute });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ((changes.loading && changes.loading.currentValue == false) || (changes.refreshTable)) {
            if (!this.dataProvidersInfo) { this.dataProvidersInfo = [] }
            if (this.dataProvidersInfo && this.delegationsData && this.delegationsData.results) {
                this.delegationsData.results.map(delegation => {
                    let correspondingInfo = this.dataProvidersInfo.find(info => info.address === delegation.to);
                    if (correspondingInfo) {
                        (delegation as any).name = correspondingInfo.name;
                        (delegation as any).icon = correspondingInfo.icon;
                    } else {
                        (delegation as any).name = 'Unknown provider';
                        (delegation as any).icon = 'assets/images/unknown.png';
                    }
                });
                this.dataSource.data = this.delegationsData.results;
                this.dataSource._updateChangeSubscription();
                this._cdr.detectChanges();

                if (!this.dynamicData) {
                    this.dataSource.sort = this.delegationsTableSort;
                    this.dataSource.paginator = this.paginator;
                    this._cdr.detectChanges();
                }
                if (this.delegationsTableSort && isNotEmpty(this.sortOnColumn) && isEmpty(this.delegationsTableSort.active)) {
                    this.delegationsTableSort.active = this.sortOnColumn;
                    this.delegationsTableSort.direction = this.sortOrder;
                    this.dataSource.sort = this.delegationsTableSort;
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
                this.requestEvent.emit(this.request as DelegatorsRequest);
            }
        }
    }
    delegationsPageChange(pageEvent?: PageEvent): void {
        if (this.dynamicData) {
            if (isNotEmpty(pageEvent)) {
                this.request.page = pageEvent.pageIndex + 1;
                this.request.pageSize = pageEvent.pageSize;
                this.requestEvent.emit(this.request as DelegatorsRequest);
            }
        }
    }
    public getSeed(input: string): number {
        return Number(input) / 10000000000000000000000000000000;
    }
}



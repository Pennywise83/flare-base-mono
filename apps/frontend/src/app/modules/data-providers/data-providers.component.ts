import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ViewEncapsulation } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink } from "@angular/router";
import { AddressTrimPipe } from "app/commons/pipes/address-trim.pipe";
import { DataProviderExtendedInfo, SortOrderEnum } from "../../../../../../libs/commons/src";
import { AppModule } from "../../app.module";
import { animations } from "../../commons/animations";
import { LoaderComponent } from "../../commons/loader/loader.component";
import { NoDataComponent } from "../../commons/no-data/no-data.component";
import { DataProviderSearchFilter } from "../delegations-explorer/delegations-explorer.component";
import { SatPopoverModule } from "@ncstate/sat-popover";
@Component({
    selector: 'flare-base-data-providers',
    templateUrl: './data-providers.component.html',
    imports: [AppModule, MatIconModule, FormsModule, MatTableModule, MatSortModule, RouterLink, LoaderComponent, FormsModule, ReactiveFormsModule,
        MatFormFieldModule, MatInputModule, NoDataComponent, AddressTrimPipe, MatTooltipModule, SatPopoverModule

    ],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    providers: [AddressTrimPipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: animations
})
export class DataProvidersComponent implements OnInit, OnChanges {
    private _parentParams: { [param: string]: string };
    @Input() selectedRewardEpoch: number;
    @Input() dataProvidersData: DataProviderExtendedInfo[] = null;
    @Input() loading: boolean = false;
    @Input() progress: number = 0;
    @Output() selectedAddress: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild('dataProvidersSort', { static: false }) public dataProvidersSort: MatSort;
    @Input() searchFilter: DataProviderSearchFilter;
    dataProvidersTableColumns: string[] = ['#', 'name', 'votePower', 'votePowerChange', 'numberOfDelegators', 'numberOfDelegatorsChange'];
    dataProvidersDataSource: MatTableDataSource<DataProviderExtendedInfo> = new MatTableDataSource();


    constructor(
        private _cdr: ChangeDetectorRef
    ) { }


    ngOnInit(): void {
        this.loading = true;
    }


    customFilter: any;
    ngOnChanges(changes: SimpleChanges): void {
        if (changes.searchFilter && (changes.searchFilter.currentValue != changes.searchFilter.previousValue)) {
            this.dataProvidersDataSource.filter = changes.searchFilter.currentValue;
            this.dataProvidersDataSource._updateChangeSubscription();
        }
        if (changes.dataProvidersData && (changes.dataProvidersData.currentValue != changes.dataProvidersData.previousValue)) {
            this.dataProvidersData = changes.dataProvidersData.currentValue;
            this.dataProvidersDataSource.data = this.dataProvidersData;
            this.dataProvidersData.filter(delegationStats => delegationStats.icon == null).map(delegationStats => {
                delegationStats.icon = 'assets/images/unknown.png';
            });
            this._cdr.detectChanges();
            if (this.dataProvidersSort) {
                this.dataProvidersSort.active = 'votePower';
                this.dataProvidersSort.direction = SortOrderEnum.desc;
                this.dataProvidersDataSource.sort = this.dataProvidersSort;
            }
            this.dataProvidersDataSource.filterPredicate = this.customFilterPredicate;
            this._cdr.detectChanges();
        }

    }
    customFilterPredicate(data: any, filters: any): boolean {
        filters = filters as DataProviderSearchFilter;
        return (filters.whitelisted != null ? data.whitelisted == filters.whitelisted : true) && (filters.listed != null ? data.listed == filters.listed : true) && ((data.name.toLowerCase().trim().indexOf(filters.nameOrAddress.toLowerCase()) != -1) || (data.address.toLowerCase().trim().indexOf(filters.nameOrAddress.toLowerCase()) != -1))
    }

    trackByFn(index: number, item: any): any {
        return item.address || index;
    }

    selectAddress(providerAddress: string): void {
        this.selectedAddress.emit(providerAddress);
    }

}

export class DataProviderFilter {
    nameFilter: string;
    whitelistFilter: string;
}


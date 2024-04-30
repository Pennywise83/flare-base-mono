/**
 * @(#)ng-date-picker.component.ts Sept 05, 2023
 *
 * @author Aakash Kumar
 */
import { DatePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { DateRange } from '@angular/material/datepicker';
import { TimeRangeDefinition } from 'app/model/time-range';
import { SelectedDateEvent } from '../public-api';

@Component({
  selector: 'ng-date-range-picker',
  templateUrl: './ng-date-picker.component.html',
  styleUrls: ['./ng-date-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgDatePickerComponent implements OnInit, AfterViewInit {
  isDateOptionList: boolean = false;
  isCustomRange: boolean = false;
  @Input() disabled: boolean = false;
  @Input() inputLabel: string = 'Date Range';
  @Input() defaultOptionId = 'custom-options';
  @Input() calendarId: string = 'custom-calendar';
  @Input() enableDefaultOptions: boolean = true;
  @Input() selectedDates!: DateRange<Date>;
  @Input() dateFormat: string = 'yyyy-MM-dd';
  @Input() isShowStaticDefaultOptions: boolean = false;
  @Input() hideDefaultOptions: boolean = false;
  @Input() cdkConnectedOverlayOffsetX = 0;
  @Input() cdkConnectedOverlayOffsetY = 0;
  @Input() listCdkConnectedOverlayOffsetY = 0;
  @Input() listCdkConnectedOverlayOffsetX = 0;
  @Input() selectedOptionIndex = 0;
  @Input() inputDate: DateRange<Date>;
  showCalendar: boolean = false;

  // default min date is current date - 10 years.
  @Input() minDate = new Date(
    new Date().setFullYear(new Date().getFullYear() - 10)
  );

  // default max date is current date - 10 years.
  @Input() maxDate = new Date(
    new Date().setFullYear(new Date().getFullYear() + 10)
  );

  @Output() onDateSelectionChanged: EventEmitter<SelectedDateEvent>;
  @Output() dateListOptions: EventEmitter<TimeRangeDefinition[]>;

  @Input() dateDropDownOptions: TimeRangeDefinition[] = [];
  inputValue: string;
  constructor(private cdref: ChangeDetectorRef, private el: ElementRef) {
    this.onDateSelectionChanged = new EventEmitter<SelectedDateEvent>();
    this.dateListOptions = new EventEmitter<TimeRangeDefinition[]>();
  }
 


  ngOnInit(): void {
    this.dateListOptions.emit(this.dateDropDownOptions);
    if (this.inputDate) {
      this.selectedDates = this.inputDate;
    }
  }

  ngAfterViewInit(): void {
    this.updateDefaultDatesValues();
  }

  /**
   * This method toggles the visibility of default date option's List.
   */
  toggleDateOptionSelectionList(): void {
    const selectedOption = this.dateDropDownOptions.filter(
      (option) => option.isSelected
    );
    if (
      selectedOption.length &&
      selectedOption[0].id === null
    ) {
      this.toggleCustomDateRangeView();
    } else {
      this.isDateOptionList = !this.isDateOptionList;
    }
  }

  /**
   * This method updates the date range on button click.
   *
   * @param input HTMLInputElement
   * @param selectedDates DateRange<Date>
   */
  updateCustomRange(
    input: HTMLInputElement,
    selectedDates: DateRange<Date>
  ): void {
    this.updateSelectedDates(
      input,
      selectedDates.start ?? new Date(),
      selectedDates.end ?? new Date()
    );
  }

  /**
   * This method update the date on specified option.
   *
   * @param option TimeRangeDefinition
   * @param input HTMLInputElement
   */
  updateSelection(option: TimeRangeDefinition, input: HTMLInputElement): void {
    this.resetOptionSelection(option);

    this.isDateOptionList = false;
    if (option.id !== null) {
      this.isCustomRange = false;
      this.updateDateOnOptionSelect(option, input);
    } else {
      this.isCustomRange = true;
    }
  }

  /**
   * This method toggles the custom date range selection view.
   */
  toggleCustomDateRangeView(): void {
    this.isCustomRange = !this.isCustomRange;
  }

  /**
   * This method sets clicked element as selected.
   * @param option TimeRangeDefinition
   */
  private resetOptionSelection(option: TimeRangeDefinition): void {
    this.dateDropDownOptions.forEach((option) => (option.isSelected = false));
    option.isSelected = true;
  }

  /**
   * This method update date if specified option is not custom range.
   *
   * @param option TimeRangeDefinition
   * @param input HTMLInputElement
   */
  private updateDateOnOptionSelect(
    option: TimeRangeDefinition,
    input: HTMLInputElement
  ): void {
    this.updateSelectedDates(input, new Date(option.getTimeRange().start), new Date(option.getTimeRange().end));
  }

  /**
   * This method updates dates on selection.
   *
   * @param input HTMLInputElement
   * @param startDate Date
   * @param endDate Date
   */
  private updateSelectedDates(
    input: HTMLInputElement,
    startDate: Date,
    endDate: Date
  ): void {
    this.selectedDates = new DateRange<Date>(startDate, endDate);
    const timeDiff: number = endDate.getTime() - startDate.getTime();
    this.dateDropDownOptions.map(timeRange => timeRange.isSelected = false);
    const timeRangeDefinitionFound: TimeRangeDefinition = this.dateDropDownOptions.find(timeRange => timeRange.timeDiff == timeDiff);
    if (timeRangeDefinitionFound && (new Date().getTime() - this.selectedDates.end.getTime() <= 5000)) {
      input.value = timeRangeDefinitionFound.label;
      timeRangeDefinitionFound.isSelected = true;
    } else {
      input.value =
        this.getDateString(startDate) + ' - ' + this.getDateString(endDate);
      this.dateDropDownOptions.find(timeRange => timeRange.id == null).isSelected = true;
    }
    const selectedOption = this.dateDropDownOptions.filter(
      (option) => option.isSelected
    )[0];
    const selectedDateEventData: SelectedDateEvent = {
      range: this.selectedDates,
      selectedOption: selectedOption,
    };
    this.onDateSelectionChanged.emit(selectedDateEventData);
    this.cdref.markForCheck();
  }

  /**
   * This method converts the given date into specified string format.
   *
   * @param date Date
   * @returns formatted date.
   */
  private getDateString(date: Date): string {
    const datePipe = new DatePipe('en');
    return (datePipe.transform(date, this.dateFormat) ?? '');
  }

  /**
   * This method return the number of days in moth on specified date.
   *
   * @param date Date
   * @returns number
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * This method clone the data.
   *
   * @param data T
   * @returns T
   */
  private getClone<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * This method update the default date values on init.
   */
  private updateDefaultDatesValues(): void {
    const input: HTMLInputElement =
      this.el.nativeElement.querySelector('#date-input-field');
      this.dateDropDownOptions.map(timeRange => timeRange.isSelected = false);
    if (
      this.selectedDates &&
      this.selectedDates.start &&
      this.selectedDates.end
    ) {
      const timeDiff: number = this.selectedDates.end.getTime() - this.selectedDates.start.getTime();
      const timeRangeDefinitionFound: TimeRangeDefinition = this.dateDropDownOptions.find(timeRange => timeRange.timeDiff == timeDiff);
      if (timeRangeDefinitionFound && (new Date().getTime() - this.selectedDates.end.getTime() <= 5000)) {
        input.value = timeRangeDefinitionFound.label;
        timeRangeDefinitionFound.isSelected = true;
      } else {
        input.value =
          this.getDateString(this.selectedDates.start) +
          ' - ' +
          this.getDateString(this.selectedDates.end);
          this.dateDropDownOptions.find(timeRange => timeRange.id == null).isSelected = true;
      }



    } else {
      const selectedOptions: TimeRangeDefinition[] =
        this.dateDropDownOptions.filter((option) => option.isSelected);
      if (
        selectedOptions.length &&
        selectedOptions[0].id !== null
      ) {
        this.updatedFromListValueSelection(selectedOptions[0], input);
      }
    }
    this.cdref.detectChanges();
  }

  /**
   * This method updates the date values based on default option selection.
   *
   * @param selectedOption TimeRangeDefinition
   * @param input HTMLInputElement
   */
  private updatedFromListValueSelection(
    selectedOption: TimeRangeDefinition,
    input: HTMLInputElement
  ): void {
    // This will update value if option is selected from provided custom list.

    // This will update value if option is selected from default list.
    this.updateDateOnOptionSelect(selectedOption, input);
  }
}

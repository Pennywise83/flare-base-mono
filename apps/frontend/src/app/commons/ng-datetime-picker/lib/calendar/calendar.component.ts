/**
 * @(#)calendar.component.scss Sept 07, 2023

 * @author Aakash Kumar
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  Renderer2,
  ViewChild,
} from '@angular/core';
import { DateRange, MatCalendar } from '@angular/material/datepicker';
import { CalendarViewData } from './../model/calendar-view-data';
import { Commons } from '../../../../../../../../libs/commons/src';

@Component({
  selector: 'lib-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent implements OnInit, AfterViewInit {
  firstCalendarViewData!: CalendarViewData;
  secondCalendarViewData!: CalendarViewData;
  @Input() selectedDates!: DateRange<Date>;
  @Input() minDate!: Date;
  @Input() maxDate!: Date;

  private isAllowHoverEvent: boolean = false;
  @Output() timeChanged = new EventEmitter<string>();

  @ViewChild('firstCalendarView') firstCalendarView!: MatCalendar<Date>;
  @ViewChild('secondCalendarView') secondCalendarView!: MatCalendar<Date>;
  hours: number[] = Array.from({ length: 24 }, (_, i) => i);
  minutes: number[] = Array.from({ length: 60 }, (_, i) => i);
  seconds: number[] = Array.from({ length: 60 }, (_, i) => i);

  startHour: number = new Date().getHours();
  startMinute: number = new Date().getMinutes();
  startSecond: number = new Date().getSeconds();
  endHour: number = new Date().getHours();
  endMinute: number = new Date().getMinutes();
  endSecond: number = new Date().getSeconds();
  emitTime() {
    const startDate: Date = new Date(Commons.clone(this.selectedDates.start));
    const endDate: Date = new Date(Commons.clone(this.selectedDates.end));
    startDate.setHours(this.startHour);
    startDate.setMinutes(this.startMinute);
    startDate.setSeconds(this.startSecond);

    endDate.setHours(this.endHour);
    endDate.setMinutes(this.endMinute);
    endDate.setSeconds(this.endSecond);
    this.selectedDates = new DateRange<Date>(startDate, endDate);
    this.cdref.markForCheck();
  }
  constructor(
    private cdref: ChangeDetectorRef,
    private el: ElementRef,
    private renderer: Renderer2
  ) { }

  ngOnInit(): void {
    this.initFirstCalendar();
    this.initSecondCalendar();
    this.startHour = this.selectedDates.start.getHours();
    this.startMinute = this.selectedDates.start.getMinutes();
    this.startSecond = this.selectedDates.start.getSeconds();
    this.endHour = this.selectedDates.end.getHours();
    this.endMinute = this.selectedDates.end.getMinutes();
    this.endSecond = this.selectedDates.end.getSeconds();
  }

  ngAfterViewInit(): void {
    this.addFirstCalendarButtonEvents();
    this.attachHoverEventOnFirstViewDates();
    this.attachHoverEventOnSecondViewDates();
    this.addSecondCalendarButtonEvents();
  }

  /**
   * This method gets all eligible cells on second view for hover event.
   */
  attachHoverEventOnSecondViewDates() {
    const nodes = this.el.nativeElement.querySelectorAll(
      '#secondCalendarView .mat-calendar-body-cell'
    );
    setTimeout(() => this.addHoverEvents(nodes), 200);
  }

  /**
   * This method handles second calendar view month selection.
   *
   * @param event Date
   */
  secondViewMonthSelected(event: Date) {
    this.removeDefaultFocus(this);
    setTimeout(() => {
      this.attachHoverEventOnSecondViewDates();
    }, 300);
  }

  /**
   * This method handles first calendar view month selection.
   *
   * @param event Date
   */
  monthSelected(event: Date) {
    this.secondCalendarView._goToDateInView(event, 'year');
    setTimeout(() => this.handleFirstCalendarNextEvent(this, true), 1);
  }

  /**
   * This method updates the date selection range.
   *
   * @param date Date
   */
  updateDateRangeSelection(date: Date | null): void {
    const selectedDates = this.selectedDates;
    if (
      !selectedDates ||
      (selectedDates.start && selectedDates.end) ||
      (selectedDates.start && date && selectedDates.start > date)
    ) {
      this.selectedDates = new DateRange<Date>(date, null);
      this.startHour = this.selectedDates.start.getHours();
      this.startMinute = this.selectedDates.start.getMinutes();
      this.startSecond = this.selectedDates.start.getSeconds();
      this.endHour = null;
      this.endMinute = null;
      this.endSecond = null;
      this.isAllowHoverEvent = true;
    } else {
      this.isAllowHoverEvent = false;
      this.selectedDates = new DateRange<Date>(selectedDates.start, date);
      this.startHour = this.selectedDates.start.getHours();
      this.startMinute = this.selectedDates.start.getMinutes();
      this.startSecond = this.selectedDates.start.getSeconds();
      this.selectedDates.end.setHours(23);
      this.selectedDates.end.setMinutes(59);
      this.selectedDates.end.setSeconds(59);
      this.endHour = this.selectedDates.end.getHours();
      this.endMinute = this.selectedDates.end.getMinutes();
      this.endSecond = this.selectedDates.end.getSeconds();
    }
    this.cdref.markForCheck();
  }

  /**
   * This method handles First calendar prev button event.
   * @param classRef CalendarComponent
   */
  private handleFirstCalDatePrevEvent(classRef: CalendarComponent): void {
    const leftDateCalender = classRef.firstCalendarView;
    if (leftDateCalender.currentView.toLocaleLowerCase() === 'month') {
      const date: Date = new Date(leftDateCalender['_clampedActiveDate']);
      classRef.secondCalendarView.minDate =
        classRef.getFirstDateOfNextMonth(date);
      classRef.cdref.markForCheck();
    }
    classRef.attachHoverEventOnFirstViewDates();
  }

  /**
   * This method gets all eligible cells on first view for hover event.
   */
  private attachHoverEventOnFirstViewDates() {
    const nodes = this.el.nativeElement.querySelectorAll(
      '#firstCalendarView .mat-calendar-body-cell'
    );
    setTimeout(() => this.addHoverEvents(nodes), 200);
  }

  /**
   * This method handle the next button event.
   *
   * @param classRef CalendarComponent
   * @param isForced boolean
   */
  private handleFirstCalendarNextEvent(
    classRef: CalendarComponent,
    isForced = false
  ): void {
    const firstCalendar = classRef.firstCalendarView;
    if (firstCalendar.currentView.toLocaleLowerCase() === 'month' || isForced) {
      const date: Date = new Date(firstCalendar['_clampedActiveDate']);
      const nextMonthDate = classRef.getFirstDateOfNextMonth(date);
      classRef.secondCalendarView.minDate = nextMonthDate;
      classRef.secondCalendarView._goToDateInView(nextMonthDate, 'month');
      classRef.removeDefaultFocus(classRef);
      classRef.cdref.markForCheck();
    }
    setTimeout(() => {
      classRef.attachHoverEventOnFirstViewDates();
      classRef.attachHoverEventOnSecondViewDates();
    }, 300);
  }

  /**
   * This method remove active focus on second view.
   *
   * @param classRef CalendarComponent
   */
  removeDefaultFocus(classRef: CalendarComponent): void {
    setTimeout(() => {
      const btn: HTMLButtonElement[] =
        classRef.el.nativeElement.querySelectorAll(
          '#secondCalendarView button.mat-calendar-body-active'
        );
      if (btn?.length) {
        btn[0].blur();
      }
    }, 1);
  }

  /**
   * This method attaches next and prev events on buttons.
   *
   */
  private addFirstCalendarButtonEvents(): void {
    const monthPrevBtn = this.el.nativeElement.querySelectorAll(
      '#firstCalendarView .mat-calendar-previous-button'
    );
    const monthNextBtn = this.el.nativeElement.querySelectorAll(
      '#firstCalendarView .mat-calendar-next-button'
    );
    this.attachClickEvent(monthPrevBtn, this.handleFirstCalDatePrevEvent);
    this.attachClickEvent(monthNextBtn, this.handleFirstCalendarNextEvent);
  }

  /**
   * This method attaches next and prev events on buttons.
   *
   */
  private addSecondCalendarButtonEvents(): void {
    const monthPrevBtn: any[] = this.el.nativeElement.querySelectorAll(
      '#secondCalendarView .mat-calendar-previous-button'
    );
    const monthNextBtn: any[] = this.el.nativeElement.querySelectorAll(
      '#secondCalendarView .mat-calendar-next-button'
    );
    if (!monthPrevBtn || !monthNextBtn) {
      return;
    }
    this.attachSecondViewClickEvent(monthPrevBtn);
    this.attachSecondViewClickEvent(monthNextBtn);
  }

  /**
   * This method attach click event of next and prev button on second view.
   *
   */
  private attachSecondViewClickEvent(nodes: any): void {
    Array.from(nodes).forEach((button) => {
      this.renderer.listen(button, 'click', () => {
        this.attachHoverEventOnSecondViewDates();
      });
    });
  }

  /**
   * This method will update the range selection on mouse hover event.
   *
   * @param date Date
   */
  private updateSelectionOnMouseHover(date: Date): void {
    const selectedDates = this.selectedDates;
    if (selectedDates?.start && date && selectedDates.start < date) {
      const dateRange: DateRange<Date> = new DateRange<Date>(
        selectedDates.start,
        date
      );
      this.firstCalendarView.selected = dateRange;
      this.secondCalendarView.selected = dateRange;
      this.firstCalendarView['_changeDetectorRef'].markForCheck();
      this.secondCalendarView['_changeDetectorRef'].markForCheck();
      this.isAllowHoverEvent = true;
    }
  }

  /**
   * This method attach hover event on specified nodes.
   *
   * @param nodes any
   */
  private addHoverEvents(nodes: any): void {
    if (!nodes) {
      return;
    }
    Array.from(nodes).forEach((button) => {
      this.renderer.listen(button, 'mouseover', (event) => {
        if (this.isAllowHoverEvent) {
          const date = new Date(event.target['ariaLabel']);
          this.updateSelectionOnMouseHover(date);
        }
      });
    });
  }

  /**
   * This method attach the next and prev events on specified nodes.
   *
   * @param nodes any
   * @param handler Function
   */
  private attachClickEvent(nodes: any, handler: Function): void {
    if (!nodes) {
      return;
    }
    Array.from(nodes).forEach((button) => {
      this.renderer.listen(button, 'click', () => {
        handler(this);
      });
    });
  }

  /**
   * This method initialize data for first calendar view.
   */
  private initFirstCalendar(): void {
    this.firstCalendarViewData = new CalendarViewData();
    this.firstCalendarViewData.startDate = this.selectedDates.start ? this.selectedDates.start : new Date();
  }

  /**
   * This method initialize data for second calendar view.
   */
  private initSecondCalendar(): void {
    const currDate = new Date();
    this.secondCalendarViewData = new CalendarViewData();
    this.secondCalendarViewData.minDate =
      this.getFirstDateOfNextMonth(currDate);
    currDate.setMonth(currDate.getMonth() + 1);
    this.secondCalendarViewData.startDate = this.selectedDates?.end
      ? this.selectedDates.end
      : currDate;
  }

  /**
   * This method returns the next months first date.
   *
   * @param currDate Date
   * @returns Date
   */
  private getFirstDateOfNextMonth(currDate: Date): Date {
    return new Date(currDate.getFullYear(), currDate.getMonth() + 1, 1);
  }
}

import { DateRange } from '@angular/material/datepicker';
import { TimeRangeDefinition } from 'app/model/time-range';

export interface SelectedDateEvent {
  range: DateRange<Date>;
  selectedOption: TimeRangeDefinition;
}

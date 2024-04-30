/**
 * @(#)default-date-options.ts Sept 08, 2023
 *
 * @author Aakash Kumar
 */
import { DEFAULT_DATE_OPTION_ENUM } from '../constant/date-filter-enum';
import { ISelectDateOption } from '../model/select-date-option';

export const DEFAULT_DATE_OPTIONS: ISelectDateOption[] = <ISelectDateOption[]>[
  {
    optionLabel: 'Today',
    optionKey: DEFAULT_DATE_OPTION_ENUM.DATE_DIFF,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Yesterday',
    optionKey: DEFAULT_DATE_OPTION_ENUM.DATE_DIFF,
    dateDiff: -1,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Last 7 Days',
    optionKey: DEFAULT_DATE_OPTION_ENUM.DATE_DIFF,
    dateDiff: -7,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Last 30 Days',
    optionKey: DEFAULT_DATE_OPTION_ENUM.DATE_DIFF,
    dateDiff: -30,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Last Month',
    optionKey: DEFAULT_DATE_OPTION_ENUM.LAST_MONTH,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'This Month',
    optionKey: DEFAULT_DATE_OPTION_ENUM.THIS_MONTH,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Month To Date',
    optionKey: DEFAULT_DATE_OPTION_ENUM.MONTH_TO_DATE,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Week To Date',
    optionKey: DEFAULT_DATE_OPTION_ENUM.WEEK_TO_DATE,
    dateDiff: 0,
    isSelected: false,
    isVisible: false,
  },
  {
    optionLabel: 'Year To Date',
    optionKey: DEFAULT_DATE_OPTION_ENUM.YEAR_TO_DATE,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
  {
    optionLabel: 'Custom Range',
    optionKey: DEFAULT_DATE_OPTION_ENUM.CUSTOM,
    dateDiff: 0,
    isSelected: false,
    isVisible: true,
  },
];

import * as moment from 'moment';

/**
 * Calculate the total number of chargeable days (excluding Sundays)
 * between two dates.
 *
 * @param startDate - The starting date
 * @param endDate - The ending date
 * @returns Total chargeable days excluding Sundays
 */
export const calculateChargeableDays = (
  startDate: moment.Moment,
  endDate: moment.Moment,
): number => {
  let totalChargeableDays = 0;
  for (let date = startDate; date.isBefore(endDate); date.add(1, 'days')) {
    if (date.day() !== 0) {
      // 0 = Sunday
      totalChargeableDays++;
    }
  }
  return totalChargeableDays;
};

'use strict';

import moment from 'moment';

export default class IntervalRecurrence {
	constructor (range) {
		var { interval, recurrence } = range;

		if (!recurrence) {
			// A falsy recurrence value just means no recurrence.
			recurrence = 'R0';
		}

		interval = this._parseISO8601(interval);
		recurrence = this._parseISO8601(recurrence);

		// Deal with various invalid inputs...

		// Interval will return false if it is invalid.
		if (!interval) {
			throw Error('Invalid interval.');
		}

		// The interval must have a date, an interval and no recurrence.
		if (interval.recurrence !== undefined || interval.date === undefined || interval.interval === undefined) {
			throw Error('Interval must have a date, an interval and no recurrence.');
		}

		// Recurrence will return false if it is invalid.
		if (!recurrence) {
			throw Error('Invalid recurrence.');
		}

		// The recurrence must have a recurrence and no date.
		if (recurrence.recurrence === undefined || recurrence.date !== undefined) {
			throw Error('Recurrence must have a recurrence, an interval and no date.');
		}

		// Recurrence can only have no interval if the recurrence is 0.
		if (recurrence.interval === undefined && recurrence.recurrence !== 0) {
			throw Error('Recurrence can only have no interval if the recurrence is 0.');
		}

		this.interval = interval;
		this.recurrence = recurrence;
		// When Babel supports it use:
		// Object.assign(this, { interval, recurrence });
	}

	containsDate (date) {
		return this._calculateRecurrence(date).containsDate;
	}

	currentRange (date) {
		var { whichRecurrence, remainder, containsDate } = this._calculateRecurrence(date);

		if (!containsDate) {
			return false;
		}

		var timeBeforeStart = moment.duration(this.recurrence.interval).asMilliseconds() * whichRecurrence;

		// Note that we need to clone these moments because they are mutable.
		var start = this.interval.date.clone().add(timeBeforeStart, 'milliseconds');
		var end = start.clone().add(this.interval.interval);

		// We return them as JavaScript Dates for library interoperability.
		return {
			start: start.toDate(),
			end: end.toDate()
		};
	}

	_calculateRecurrence (date) {
		date = moment(date);

		// Calculate what recurrence we are in.
		var difference = date.diff(this.interval.date);
		var recurring_period = (this.recurrence.interval !== undefined) ? this.recurrence.interval.asMilliseconds() : 0;

		if (recurring_period === 0) {
			recurring_period = Infinity;
		}

		var whichRecurrence = Math.floor(difference / recurring_period);
		var remainder = difference % recurring_period;

		var containsDate;

		if ( (whichRecurrence > this.recurrence.recurrence) ) {
			// Check we're within allowed recurrences.
			// An value of Infinity suggests that the recurrence interval is zero.
			containsDate = false;
		} else if (remainder > this.interval.interval.asMilliseconds()) {
			// Finally check whether we are in the interval for this recurrence.
			containsDate = false;
		} else {
			// If we got here it must be true, right?
			containsDate = true;
		}

		return { whichRecurrence, remainder, containsDate };
	}

	_parseISO8601 (date) {
		// Split the date string by slashes.
		try {
			date = date.split('/');
		} catch (e) {
			return false;
		}

		// Begin the object that we will return with the constitutent parts.
		var dateObject = {};

		// First deal with number of repetitions, if any.
		if (date[0].substring(0, 1) === 'R') {
			var recurrence = date[0].substring(1);
			if (recurrence === '') {
				dateObject.recurrence = Infinity;
			} else {
				recurrence = Number.parseInt(recurrence);
				if (!Number.isNaN(recurrence)) {
					dateObject.recurrence = recurrence;
				} else {
					return false;
				}
			}
			// The number of repetitions are then removed from the array.
			date.shift();
		}

		// If we have a zero length array, it's only ok if there has been a
		// recurrence. We technically want this to be a recurrence of zero,
		// but that is done in the constructor instead of here as a solo
		// recurrence that does not equal zer0 may be of some meaning to
		// other applicatons of this parsing function.
		if (date.length === 0) {
			return dateObject;
		}

		// Make some prelimiary determinations about the first index of the array.
		// Here we build a moment Object ahead of time, and check the validity of the
		// first index as a date or interval.
		var date0 = moment(date[0], moment.ISO_8601, true);
		var isDate0 = date0.isValid();
		var isInterval0 = (date[0].substring(0, 1) === 'P') && (moment.duration(date[0]) > 0);

		if (date.length === 2) {
			// If the lenght of the array is two, there is more to do. We make the same
			// preliminary determinations about the second index.
			var date1 = moment(date[1], moment.ISO_8601, true);
			var isDate1 = date1.isValid();
			var isInterval1 = (date[1].substring(0, 1) === 'P') && (moment.duration(date[1]) > 0);

			if (isDate0 && isDate1) {
				// If they are both valid dates...
				if (dateObject.recurrence !== undefined) {
					// ... with a repetition that is invalid.
					return false;
				} else {
					// ... we can turn the second date into a period.
					dateObject.date = date0;
					dateObject.interval = moment.duration(date1.diff(date0));
					return dateObject;
				}
			} else if (isDate0 && isInterval1) {
				// If the first is a date and the second an interval, we have a basic
				// ISO8601 interval with a start date.
				dateObject.date = date0;
				dateObject.interval = moment.duration(date[1]);
				return dateObject;
			} else if (isInterval0 && isDate1) {
				// If the first is an interval and the second is a date, we have a
				// more complicated interval with an end date. However, we can just
				// invert the sign on the interval and treat it like normal.
				var interval = moment.duration(date[0]);

				dateObject.date = date1.subtract(interval);
				dateObject.interval = interval;
				return dateObject;
			} else {
				// Any other form of a two-length array must be invalid.
				return false;
			}
		} else if (date.length === 1) {
			// If the length of the array is one, we may be looking at some trivial dates.
			if (isDate0) {
				// If the value is a valid date...
				if (dateObject.recurrence) {
					// ... it is invalid with a repetition.
					return false;
				} else {
					// ... we can just return it.
					dateObject.date = date0;
					return dateObject;
				}
			} else if (isInterval0) {
				// An interval on its own is valid, as is it with a repetition.
				dateObject.interval = moment.duration(date[0]);
				return dateObject;
			} else {
				// All other formations are invalid.
				return false;
			}
		} else {
			// Any other array lenghts at this stage are invalid.
			return false;
		}
	}
}

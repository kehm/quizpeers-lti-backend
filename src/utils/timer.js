/**
 * True if deadline has expired
 *
 * @param {string} deadline Timestamp
 * @returns {boolean} True if expired
 */
export const isExpired = (deadline) => {
    if (Date.parse(deadline) < Date.parse(new Date())) {
        return true;
    }
    return false;
};

/**
 * True if assignment is no longer active
 *
 * @param {Object} assignment Assignment object
 * @returns {boolean} True if expired
 */
export const isAssignmentExpired = (assignment) => {
    if (assignment.status === 'FINISHED' || assignment.status === 'PUBLISHED_NO_SOLUTION'
        || assignment.status === 'PUBLISHED_WITH_SOLUTION' || isExpired(assignment.deadline)) {
        return true;
    }
    return false;
};

/**
 * Extend timer
 *
 * @param {Array} timer Current timer
 * @param {int} extMins Minutes to add
 * @returns {Array} Updated timer
 */
export const extendTimer = (timer, extMins) => {
    let hrs = timer[0];
    let mins = timer[1];
    mins += extMins;
    if (mins > 59) {
        const hours = mins / 60;
        const rhours = Math.floor(hours);
        const minutes = (hours - rhours) * 60;
        const rminutes = Math.round(minutes);
        hrs += rhours;
        mins = rminutes;
    }
    return [hrs, mins];
};

/**
 * Calculate deadline
 *
 * @param {string} started Started at timestamp
 * @param {string} deadline Deadline timestamp
 * @param {Arrray} timer Assignment timer (optional)
 * @param {int} extMins Minutes to add
 * @returns {Object} Final deadline
 */
export const getDeadline = (started, deadline, timer, extMins) => {
    let end = new Date(deadline);
    if (timer) {
        if (extMins) timer = extendTimer(timer, extMins);
        const created = new Date(started);
        const hrs = timer[0];
        const mins = timer[1];
        created.setHours(created.getHours() + hrs);
        created.setMinutes(created.getMinutes() + mins);
        if (Date.parse(end) > Date.parse(created)) end = created;
    }
    return end;
};

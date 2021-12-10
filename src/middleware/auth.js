/**
 * Check if valid session
 */
export const isAuthenticated = (req, res, next) => {
    if (req.session.userId && req.session.courseId) {
        next();
    } else res.sendStatus(403);
};

/**
 * Check if user is an instructor
 */
export const isInstructor = (req, res, next) => {
    if (req.session.role && req.session.role === process.env.ROLE_TEACHER) {
        next();
    } else res.sendStatus(403);
};

/**
 * Check if user is a learner/student
 */
export const isLearner = (req, res, next) => {
    if (req.session.role && req.session.role === process.env.ROLE_STUDENT) {
        next();
    } else res.sendStatus(403);
};

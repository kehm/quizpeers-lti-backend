import express from 'express';
import { isAuthenticated, isInstructor, isLearner } from '../middleware/auth.js';

const router = express.Router();

/**
 * Return HTTP status 200 if user is an instructor
 */
router.post('/instructor', isAuthenticated, isInstructor, (req, res) => {
    res.sendStatus(200);
});

/**
 * Return HTTP status 200 if user is a learner/student
 */
router.post('/learner', isAuthenticated, isLearner, (req, res) => {
    res.sendStatus(200);
});

/**
 * Invalidate session
 */
router.post('/invalidate', isAuthenticated, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.clearCookie(process.env.SESSION_NAME);
            res.sendStatus(200);
        }
    });
});

export default router;

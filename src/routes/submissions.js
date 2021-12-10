import express from 'express';
import checkAPIs from 'express-validator';
import { isAuthenticated, isInstructor, isLearner } from '../middleware/auth.js';
import isValidInput from '../middleware/input.js';
import { logError, logInfo } from '../utils/logger.js';
import {
    evaluateQuizSubmission, getPendingSubmissions, getPublishedSubmissions,
    getQuizTasks, getStartedSubmission, getSubmission, publishSubmissionResults, saveQuizAnswers,
} from '../utils/submissions.js';

const router = express.Router();
const { body, param, query } = checkAPIs;

/**
 * Get existing submission object for the assignment
 */
router.get('/assignment/:assignmentId', isAuthenticated, isLearner, [
    param('assignmentId').isInt({ min: 1 }),
    query('start').isBoolean().optional(),
], isValidInput, async (req, res) => {
    try {
        const start = JSON.parse(req.query.start);
        const submission = await getSubmission(
            req.params.assignmentId,
            req.session,
            start,
            start ? 'STARTED' : undefined,
        );
        if (submission) {
            res.status(200).json(submission);
        } else res.sendStatus(404);
    } catch (err) {
        logError('The assignment has expired', err);
        res.sendStatus(405);
    }
});

/**
 * Get quiz tasks with answers and solution
 */
router.get('/quiz/:submissionId', isAuthenticated, isInstructor, [
    param('submissionId').isUUID(),
], isValidInput, async (req, res) => {
    try {
        const submissions = await getQuizTasks(
            req.params.submissionId,
            req.session.consumerId,
            req.session.courseId,
        );
        res.status(200).json(submissions);
    } catch (err) {
        logError('Could not query quiz answers', err);
        res.sendStatus(500);
    }
});

/**
 * Get submissions for the assignment that are either pending evaluations or not published
 */
router.get('/pending/:assignmentId', isAuthenticated, isInstructor, [
    param('assignmentId').isInt({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const submissions = await getPendingSubmissions(
            req.params.assignmentId,
            req.session.consumerId,
            req.session.courseId,
        );
        res.status(200).json(submissions);
    } catch (err) {
        logError('Could not query pending submissions', err);
        res.sendStatus(500);
    }
});

/**
 * Get submissions with published evaluations
 */
router.get('/published/:assignmentId', isAuthenticated, isInstructor, [
    param('assignmentId').isInt({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const submissions = await getPublishedSubmissions(
            req.params.assignmentId,
            req.session.consumerId,
            req.session.courseId,
        );
        res.status(200).json(submissions);
    } catch (err) {
        logError('Could not query published submissions', err);
        res.sendStatus(500);
    }
});

/**
 * Save quiz answers
 */
router.post('/quiz/save/:submissionId', isAuthenticated, isLearner, [
    param('submissionId').isUUID(),
    body('tasks').isArray({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const submission = await getStartedSubmission(req.params.submissionId, req.session);
        try {
            if (submission) {
                await saveQuizAnswers(
                    submission,
                    req.body.tasks,
                    req.session,
                );
                res.sendStatus(200);
            } else {
                logError('Could not find started submission');
                res.sendStatus(404);
            }
        } catch (err) {
            logError('Could not save quiz answers', err);
            res.sendStatus(500);
        }
    } catch (err) {
        logInfo('The assignment has expired', err);
        res.sendStatus(405);
    }
});

/**
 * Submit quiz answers and calculate score
 */
router.post('/quiz/:submissionId', isAuthenticated, isLearner, [
    param('submissionId').isUUID(),
], isValidInput, async (req, res) => {
    try {
        const submission = await getStartedSubmission(req.params.submissionId, req.session);
        try {
            if (submission) {
                await evaluateQuizSubmission(submission);
                res.sendStatus(200);
            } else {
                logError('Could not find started submission');
                res.sendStatus(404);
            }
        } catch (err) {
            logError('Could not save quiz answers', err);
            res.sendStatus(500);
        }
    } catch (err) {
        logInfo('The assignment has expired', err);
        res.sendStatus(405);
    }
});

/**
 * Publish result of selected submissions
 */
router.post('/publish', isAuthenticated, isInstructor, [
    body('assignmentId').isInt({ min: 1 }),
    body('submissions').isArray({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        await publishSubmissionResults(
            req.body.assignmentId,
            req.body.submissions,
            req.session,
        );
        res.sendStatus(200);
    } catch (err) {
        logError('Could not publish selected submissions', err);
        res.sendStatus(500);
    }
});

export default router;

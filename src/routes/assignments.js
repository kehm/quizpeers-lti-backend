import express from 'express';
import checkAPIs from 'express-validator';
import { isAuthenticated, isInstructor } from '../middleware/auth.js';
import isValidInput from '../middleware/input.js';
import {
    createQuizAssignment, createTaskAssignment, getAssignment, getTaskAssignments, publishSolution,
} from '../utils/assignments.js';
import { logError } from '../utils/logger.js';

const router = express.Router();
const { body, param } = checkAPIs;

/**
 * Get assignment from ID
 */
router.get('/:assignmentId', isAuthenticated, [
    param('assignmentId').isInt({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const assignment = await getAssignment(
            req.params.assignmentId,
            req.session,
        );
        if (assignment) {
            res.status(200).json(assignment);
        } else res.sendStatus(404);
    } catch (err) {
        logError('Could not query assignments', err);
        res.sendStatus(500);
    }
});

/**
 * Get all task assignments for this course
 */
router.get('/type/task', isAuthenticated, isInstructor, async (req, res) => {
    try {
        const assignments = await getTaskAssignments(req.session);
        res.status(200).json(assignments);
    } catch (err) {
        logError('Could not query task assignments', err);
        res.sendStatus(500);
    }
});

/**
 * Create a task assignment
 */
router.post('/task', isAuthenticated, isInstructor, [
    body('title').isString().isLength({ min: 1 }),
    body('types').isArray({ min: 1, max: 3 }),
    body('size').isInt({ min: 1, max: 50 }),
    body('deadline').custom((value) => {
        if (Date.parse(value) <= Date.parse(new Date())) throw new Error('Invalid value');
        return true;
    }),
    body('timer').isArray({ min: 2, max: 2 }).optional(),
    body('glossary').isArray({ min: 1 }).optional(),
], isValidInput, async (req, res) => {
    try {
        const assignment = await createTaskAssignment(req.session, req.body);
        res.status(200).json(assignment);
    } catch (err) {
        logError('Could not create new task assignment', err);
        res.sendStatus(500);
    }
});

/**
 * Create a quiz assignment
 */
router.post('/quiz', isAuthenticated, isInstructor, [
    body('title').isString().isLength({ min: 1 }),
    body('type').custom((value) => {
        if (!['DEFINITE', 'RANDOM'].some((element) => element === value)) throw new Error('Invalid value');
        return true;
    }),
    body('assignments').isArray({ min: 1 }),
    body('tasks').isArray({ min: 1 }),
    body('difficulties').isArray({ min: 1 }),
    body('deadline').custom((value) => {
        if (!value) throw new Error('Missing value');
        if (Date.parse(value) <= Date.parse(new Date())) throw new Error('Invalid value');
        return true;
    }),
    body('timer').isArray({ min: 2, max: 2 }).optional(),
    body('size').isJSON().optional(),
    body('weight').isJSON().optional(),
], isValidInput, async (req, res) => {
    try {
        const assignment = await createQuizAssignment(req.session, req.body);
        res.status(200).json(assignment);
    } catch (err) {
        logError('Could not create new quiz assignment', err);
        res.sendStatus(500);
    }
});

/**
 * Publish/unpublish quiz solution
 */
router.post('/publish', isAuthenticated, isInstructor, [
    body('assignmentId').isInt({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        await publishSolution(req.body.assignmentId, req.session);
        res.sendStatus(200);
    } catch (err) {
        logError('Could not publish/unpublish quiz solution', err);
        res.sendStatus(500);
    }
});

export default router;

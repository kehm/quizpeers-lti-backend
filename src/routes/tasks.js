import express from 'express';
import checkAPIs from 'express-validator';
import { isAuthenticated, isInstructor, isLearner } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import isValidInput from '../middleware/input.js';
import { logError } from '../utils/logger.js';
import {
    createOrReplaceTask, createTaskGroup, deleteTaskEdit, evaluateTask,
    getIncludedTasks, getSubmittedTasks, getTaskGroupInfo, getTaskGroups, getTaskSolutions,
} from '../utils/tasks.js';
import { removeUploadedMedia, resizeImages } from '../utils/media.js';

const router = express.Router();
const { body, param } = checkAPIs;

/**
 * Get all tasks connected to the selected task submission
 */
router.get('/submission/:submissionId', isAuthenticated, [
    param('submissionId').isUUID(),
], isValidInput, async (req, res) => {
    try {
        const tasks = await getSubmittedTasks(req.params.submissionId, req.session);
        res.status(200).json(tasks);
    } catch (err) {
        logError('Could not query submitted tasks', err);
    }
});

/**
 * Get all task groups associated with the assignment
 */
router.get('/groups/:assignmentId', isAuthenticated, isInstructor, [
    param('assignmentId').isInt(),
], isValidInput, async (req, res) => {
    try {
        const tasks = await getTaskGroups(
            req.params.assignmentId,
            req.session.consumerId,
            req.session.courseId,
        );
        res.status(200).json(tasks);
    } catch (err) {
        logError('Could not query task groups', err);
    }
});

/**
 * Get solutions for submission tasks
 */
router.get('/solution/:submissionId', isAuthenticated, isLearner, [
    param('submissionId').isUUID(),
], isValidInput, async (req, res) => {
    try {
        const tasks = await getTaskSolutions(
            req.params.submissionId,
            req.session,
        );
        res.status(200).json(tasks);
    } catch (err) {
        logError('Could not query task solutions', err);
        res.sendStatus(500);
    }
});

/**
 * Get approved tasks for the specified assignments
 */
router.post('/include', isAuthenticated, isInstructor, [
    body('assignmentIds').isArray({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const tasks = await getIncludedTasks(
            req.session.consumerId,
            req.session.courseId,
            req.body.assignmentIds,
        );
        res.status(200).json(tasks);
    } catch (err) {
        logError('Could not query approved tasks', err);
        res.sendStatus(500);
    }
});

/**
 * Get info for the selected groups
 */
router.post('/groups', isAuthenticated, isInstructor, [
    body('groupIds').isArray({ min: 1 }),
], isValidInput, async (req, res) => {
    try {
        const tasks = await getTaskGroupInfo(
            req.session.consumerId,
            req.session.courseId,
            req.body.groupIds,
        );
        res.status(200).json(tasks);
    } catch (err) {
        logError('Could not query task group info', err);
        res.sendStatus(500);
    }
});

/**
 * Create new multiple choice task (and create new submission if none exists)
 */
router.post('/multiple-choice', isAuthenticated, upload, [
    body('assignmentId').isInt({ min: 1 }),
    body('type').equals('MULTIPLE_CHOICE'),
    body('title').isString().isLength({ min: 1 }),
    body('description').isString().isLength({ min: 1 }),
    body('mediaId').isString().isLength({ min: 1 }).optional(),
    body('options').isArray({ min: 2, max: 6 }),
    body('indexSolution').isInt({ min: 0, max: 5 }),
    body('taskId').isInt({ min: 1 }).optional(),
    body('replace').isBoolean().optional(),
], isValidInput, async (req, res) => {
    try {
        await resizeImages(req.files, 128, 128, 90, 'thumbnail');
        await createOrReplaceTask(
            req.body,
            req.locals && req.locals.mediaIds,
            req.session,
        );
        res.sendStatus(200);
    } catch (err) {
        logError('Could not create new multiple choice task', err);
        removeUploadedMedia(req.locals && req.locals.mediaIds);
        res.sendStatus(405);
    }
});

/**
 * Create new combine terms task (and create new submission if none exists)
 */
router.post('/combine-terms', isAuthenticated, upload, [
    body('assignmentId').isInt({ min: 1 }),
    body('type').equals('COMBINE_TERMS'),
    body('title').isString().isLength({ min: 1 }),
    body('description').isString().isLength({ min: 1 }),
    body('options').isArray({ min: 2, max: 6 }),
    body('taskId').isInt({ min: 1 }).optional(),
    body('replace').isBoolean().optional(),
], isValidInput, async (req, res) => {
    try {
        await resizeImages(req.files, 128, 128, 90, 'thumbnail');
        await createOrReplaceTask(
            req.body,
            req.locals && req.locals.mediaIds,
            req.session,
        );
        res.sendStatus(200);
    } catch (err) {
        logError('Could not create new combine terms task', err);
        removeUploadedMedia(req.locals && req.locals.mediaIds);
        res.sendStatus(405);
    }
});

/**
 * Create new name image task (and create new submission if none exists)
 */
router.post('/name-image', isAuthenticated, upload, [
    body('assignmentId').isInt({ min: 1 }),
    body('type').equals('NAME_IMAGE'),
    body('title').isString().isLength({ min: 1 }),
    body('description').isString().isLength({ min: 1 }).optional(),
    body('mediaId').isString().isLength({ min: 1 }).optional(),
    body('solution').isString().isLength({ min: 1 }),
    body('taskId').isInt({ min: 1 }).optional(),
    body('replace').isBoolean().optional(),
], isValidInput, async (req, res) => {
    try {
        await resizeImages(req.files, 128, 128, 90, 'thumbnail');
        await createOrReplaceTask(
            req.body,
            req.locals && req.locals.mediaIds,
            req.session,
        );
        res.sendStatus(200);
    } catch (err) {
        logError('Could not create new name image task', err);
        removeUploadedMedia(req.locals && req.locals.mediaIds);
        res.sendStatus(405);
    }
});

/**
 * Create new task group for the assignment
 */
router.post('/group', isAuthenticated, isInstructor, [
    body('assignmentId').isInt({ min: 1 }),
    body('name').isString().isLength({ min: 1 }),
    body('description').isString().isLength({ min: 1 }).optional(),
], isValidInput, async (req, res) => {
    try {
        await createTaskGroup(req.body, req.session);
        res.sendStatus(200);
    } catch (err) {
        logError('Could not create new task group', err);
        res.sendStatus(500);
    }
});

/**
 * Set score and whether to include the task in quiz selections or not
 */
router.post('/evaluate/:taskId', isAuthenticated, isInstructor, [
    param('taskId').isInt({ min: 1 }),
    body('submissionId').isUUID(),
    body('score').isInt({ min: 0 }).optional(),
    body('include').isBoolean(),
    body('groupId').isInt({ min: 1 }).optional(),
], isValidInput, async (req, res) => {
    try {
        await evaluateTask(req.params.taskId, req.body, req.session);
        res.sendStatus(200);
    } catch (err) {
        logError('Could not submit task evaluation', err);
        res.sendStatus(500);
    }
});

/**
 * Delete the edit column from a task
 */
router.delete('/edit/:taskId', isAuthenticated, isInstructor, [
    param('taskId').isInt(),
], isValidInput, async (req, res) => {
    try {
        await deleteTaskEdit(req.params.taskId, req.session);
        res.sendStatus(200);
    } catch (err) {
        logError('Could not delete edit from task', err);
        res.sendStatus(500);
    }
});

export default router;

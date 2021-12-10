import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Task from '../models/Task.js';
import TaskGroup from '../models/TaskGroup.js';
import TaskGroupTasks from '../models/TaskGroupTasks.js';
import { removeUploadedMedia } from './media.js';
import { organizeTerms, shuffleArray } from './quiz.js';
import { evaluateTaskSubmission, finishSubmission, getSubmission } from './submissions.js';

/**
 * Initialize terms arrays for combine terms tasks
 *
 * @param {Array} tasks Tasks
 */
const initializeTerms = (tasks) => {
    tasks.forEach((task) => {
        if (task.type === 'COMBINE_TERMS') {
            task.options = organizeTerms(task.options, task.solution);
            if (task.edit) {
                task.edit.options = organizeTerms(task.edit.options, task.edit.solution);
            }
        }
    });
};

/**
 * Get all included tasks for the selected course (and assignment)
 *
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @param {string} getIncludedTasks Assignment IDs
 * @returns {Array} Tasks
 */
export const getIncludedTasks = async (consumerId, courseId, assignmentIds) => {
    const tasks = await postgres.query(
        'SELECT DISTINCT ON (task.task_id) task.task_id, task.title, task.description, task.task_type_name, task.submission_id, '
        + 'task.score, task.options, task.solution, task.edit, task.created_at, task_group_tasks.task_group_id FROM task '
        + 'INNER JOIN submission '
        + 'ON task.submission_id = submission.submission_id '
        + 'INNER JOIN assignment '
        + 'ON submission.assignment_id = assignment.assignment_id '
        + 'LEFT JOIN task_group_tasks '
        + 'ON task.task_id = task_group_tasks.task_id '
        + 'WHERE task.task_status_name = \'EVALUATED_INCLUDE\' '
        + 'AND assignment.consumer_id = ? '
        + 'AND assignment.course_id = ? '
        + 'AND assignment.assignment_id in (?) '
        + 'ORDER BY task.task_id ',
        {
            type: Sequelize.QueryTypes.SELECT,
            replacements: [consumerId, courseId, assignmentIds],
            model: Task,
            mapToModel: true,
            raw: true,
        },
    );
    initializeTerms(tasks);
    return tasks;
};

/**
 * Get solution for submission tasks
 *
 * @param {string} submissionId Submission ID
 * @param {Object} session Session object
 */
export const getTaskSolutions = async (submissionId, session) => {
    const submission = await Submission.findOne({
        where: {
            id: submissionId,
            userId: session.userId,
        },
        include: {
            model: Assignment,
            where: {
                status: 'PUBLISHED_WITH_SOLUTION',
                consumerId: session.consumerId,
                courseId: session.courseId,
            },
            required: true,
        },
    });
    if (submission) {
        let tasks = await Task.findAll({
            where: {
                id: { [Sequelize.Op.in]: submission.tasks.map((task) => task.task.id) },
            },
            attributes: ['id', 'solution', 'edit'],
            raw: true,
        });
        tasks = tasks.map((task) => ({
            id: task.id,
            solution: task.edit ? task.edit.solution : task.solution,
        }));
        return tasks;
    }
    throw new Error('Could not find submission');
};

/**
 * Get tasks associated with the submission
 *
 * @param {string} submissionId Submission ID
 * @param {Object} session Session object
 * @returns {Array} Tasks
 */
export const getSubmittedTasks = async (submissionId, session) => {
    let tasks = [];
    if (session.role === process.env.ROLE_TEACHER) {
        tasks = await postgres.query(
            'SELECT DISTINCT ON (task.task_id) task.task_id, task.title, task.description, task.media_id, task.task_type_name, task.score, '
            + 'task.task_status_name, task.options, task.solution, task.edit, task.created_at, task_group.task_group_id FROM task '
            + 'INNER JOIN submission '
            + 'ON task.submission_id = submission.submission_id '
            + 'INNER JOIN assignment '
            + 'ON submission.assignment_id = assignment.assignment_id '
            + 'LEFT JOIN task_group_tasks '
            + 'ON task.task_id = task_group_tasks.task_id '
            + 'LEFT JOIN task_group '
            + 'ON task_group_tasks.task_group_id = task_group.task_group_id '
            + 'WHERE task.submission_id = ? '
            + 'AND assignment.consumer_id = ? '
            + 'AND assignment.course_id = ? '
            + 'ORDER BY task.task_id ',
            {
                type: Sequelize.QueryTypes.SELECT,
                replacements: [submissionId, session.consumerId, session.courseId],
                model: Task,
                mapToModel: true,
                raw: true,
            },
        );
    } else {
        tasks = await postgres.query(
            'SELECT DISTINCT ON (task.task_id) task.task_id, task.title, task.description, task.media_id, task.task_type_name, '
            + 'task.task_status_name, task.options, task.solution, task.created_at FROM task '
            + 'INNER JOIN submission '
            + 'ON task.submission_id = submission.submission_id '
            + 'INNER JOIN assignment '
            + 'ON submission.assignment_id = assignment.assignment_id '
            + 'WHERE task.submission_id = ? '
            + 'AND assignment.consumer_id = ? '
            + 'AND assignment.course_id = ? '
            + 'AND submission.quizpeers_user_id = ? '
            + 'ORDER BY task.task_id ',
            {
                type: Sequelize.QueryTypes.SELECT,
                replacements: [submissionId, session.consumerId, session.courseId, session.userId],
                model: Task,
                mapToModel: true,
                raw: true,
            },
        );
    }
    initializeTerms(tasks);
    return tasks;
};

/**
 * Get task groups associated with the assignment
 *
 * @param {int} assignmentId Assignment ID
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 */
export const getTaskGroups = async (assignmentId, consumerId, courseId) => {
    const groups = await postgres.query(
        'SELECT task_group.task_group_id as id, task_group.name, task_group.description FROM task_group '
        + 'INNER JOIN assignment '
        + 'ON task_group.assignment_id = assignment.assignment_id '
        + 'WHERE task_group.assignment_id = ? '
        + 'AND assignment.consumer_id = ?'
        + 'AND assignment.course_id = ?',
        {
            type: Sequelize.QueryTypes.SELECT,
            replacements: [assignmentId, consumerId, courseId],
            model: TaskGroup,
            mapToModel: true,
            raw: true,
        },
    );
    return groups;
};

/**
 * Get info for the selected task groups
 *
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @param {Array} groupIds Group IDs
 */
export const getTaskGroupInfo = async (consumerId, courseId, groupIds) => {
    const groups = await TaskGroup.findAll({
        attributes: ['id', 'name', 'description'],
        where: {
            id: { [Sequelize.Op.in]: groupIds },
        },
        include: [
            {
                model: Assignment,
                where: {
                    consumerId,
                    courseId,
                },
                attributes: ['id'],
                required: true,
            },
        ],
    });
    return groups;
};

/**
 * Create multiple choice options array
 *
 * @param {Object} values Submitted values
 * @returns {Object} Options array and solution
 */
const createMultipleChoiceOptions = (values) => {
    const ids = [];
    let counter = 0;
    while (counter < values.options.length) {
        ids.push(counter + 1);
        counter += 1;
    }
    shuffleArray(ids);
    const set = new Set();
    const options = values.options.map((option) => {
        set.add(option);
        const id = ids[0];
        ids.shift();
        return { id, option };
    });
    if (Array.from(set).length !== options.length) {
        throw new Error('Each task option must be unique');
    }
    const solution = options[values.indexSolution].id;
    return { options, solution };
};

/**
 * Create combine terms options array
 *
 * @param {Object} values Submitted values
 * @param {Array} mediaIds Terms media IDs
 * @returns {Object} Options array and solution
 */
const createCombineTermsOptions = (values, mediaIds) => {
    const ids = [];
    let counter = 0;
    while (counter < values.options.length * 2) {
        ids.push(counter + 1);
        counter += 1;
    }
    shuffleArray(ids);
    const options = [];
    const solution = [];
    values.options.forEach((option) => {
        const pair = JSON.parse(option);
        if (pair.term.type === 'IMAGE' && pair.term.term < 12) {
            pair.term.term = mediaIds[pair.term.term];
        }
        if (pair.relatedTerm.type === 'IMAGE' && pair.relatedTerm.term < 12) {
            pair.relatedTerm.term = mediaIds[pair.relatedTerm.term];
        }
        const id = ids[0];
        options.push({
            id,
            type: pair.term.type,
            term: pair.term.term,
        });
        ids.shift();
        options.push({
            id: ids[0],
            type: pair.relatedTerm.type,
            term: pair.relatedTerm.term,
        });
        solution.push([id, ids[0]]);
        ids.shift();
    });
    return { options, solution };
};

/**
 * Set task options (and remove any existing terms images)
 *
 * @param {Object} task Task object
 * @param {Object} values Submitted values
 * @param {Array} mediaIds Media IDs of any uploaded images (optional)
 * @param {boolean} replace True if delete existing media
 * @returns {Object} Updated task object
 */
const setTaskOptionsAndMedia = (task, values, mediaIds, replace) => {
    let tmpTask = { ...task };
    if (replace && task.type === 'COMBINE_TERMS' && task.options) {
        const existingTermsMedia = [];
        task.options.forEach((option) => {
            if (option.type === 'IMAGE') existingTermsMedia.push(option.term);
        });
        removeUploadedMedia(existingTermsMedia);
    }
    if (values.type === 'MULTIPLE_CHOICE') {
        if (mediaIds && mediaIds.length > 0) tmpTask.mediaId = mediaIds[0];
        const { options, solution } = createMultipleChoiceOptions(values);
        tmpTask = { ...tmpTask, options, solution };
    } else if (values.type === 'COMBINE_TERMS') {
        const { options, solution } = createCombineTermsOptions(values, mediaIds);
        tmpTask = { ...tmpTask, options, solution };
    } else if (values.type === 'NAME_IMAGE') {
        tmpTask = { ...tmpTask, options: mediaIds, solution: values.solution };
    }
    return tmpTask;
};

/**
 * Remove the submitted task
 *
 * @param {Object} values Submitted values
 * @param {Object} session Session object
 * @param {Array} mediaIds Media IDs of any uploaded images (optional)
 * @param {Object} submission Submission object
 * @param {Array} tasks Tasks array
 */
const replaceTask = async (values, session, mediaIds, submission, tasks) => {
    let task = await Task.findOne({
        where: {
            id: values.taskId,
            status: 'PENDING',
        },
    }, {
        include: [
            {
                model: Submission,
                where: {
                    status: { [Sequelize.Op.in]: ['PENDING', 'STARTED'] },
                    userId: session.userId,
                },
                required: true,
            },
        ],
    });
    if (task) {
        const existingMedia = task.mediaId;
        task.mediaId = null;
        task = setTaskOptionsAndMedia(task, values, mediaIds, true);
        await Task.update({
            title: values.title,
            description: values.description,
            mediaId: task.mediaId || null,
            type: values.type,
            options: task.options,
            solution: task.solution,
        }, {
            where: {
                id: values.taskId,
            },
        });
        if (tasks.length === submission.size) await finishSubmission(submission.id, session);
        if (existingMedia) await removeUploadedMedia([existingMedia]);
    } else throw new Error('Could not find task to replace');
};

/**
 * Save task edit
 *
 * @param {Object} values Submitted values
 * @param {string} userId User ID
 * @param {Array} mediaIds Media IDs of any uploaded images (optional)
 */
const editTask = async (values, userId, mediaIds) => {
    let task = { ...values };
    task.editedBy = userId;
    task.editedAt = new Date();
    task = setTaskOptionsAndMedia(task, values, mediaIds, false);
    await Task.update({
        edit: {
            title: task.title,
            description: task.description,
            mediaId: task.mediaId,
            options: task.options,
            solution: task.solution,
        },
    }, {
        where: {
            id: task.taskId,
        },
    });
};

/**
 * Create new task
 *
 * @param {Object} values Request values
 * @param {Object} submission Submission object
 * @param {Array} tasks Tasks array
 * @param {Array} mediaIds Media IDs of any uploaded images (optional)
 * @param {Object} session Session object
 */
const createTask = async (values, submission, tasks, mediaIds, session) => {
    let task = {
        title: values.title,
        description: values.description,
        type: values.type,
        submissionId: submission.id,
        status: session.role === process.env.ROLE_TEACHER ? 'EVALUATED_INCLUDE' : 'PENDING',
    };
    task = setTaskOptionsAndMedia(task, values, mediaIds, false);
    await Task.create(task);
    if (tasks.length + 1 === submission.size) await finishSubmission(submission.id, session);
};

/**
 * Create new task (and create new submission if not already exists)
 *
 * @param {Object} values Request values
 * @param {Array} mediaIds Media IDs of any uploaded images (optional)
 * @param {Object} session Session object
 */
export const createOrReplaceTask = async (values, mediaIds, session) => {
    if (values.taskId && !JSON.parse(values.replace)) {
        await editTask(values, session.userId, mediaIds);
    } else {
        const submission = await getSubmission(
            values.assignmentId,
            session,
            true,
            session.role === process.env.ROLE_TEACHER ? undefined : 'STARTED',
        );
        const tasks = await getSubmittedTasks(submission.id, session);
        if (values.taskId && JSON.parse(values.replace)) {
            await replaceTask(values, session, mediaIds, submission, tasks);
        } else if ((submission.status === 'STARTED' && tasks.length < submission.size) || session.role === process.env.ROLE_TEACHER) {
            await createTask(values, submission, tasks, mediaIds, session);
        } else throw new Error('Assignment is already completed');
    }
};

/**
 * Create new task group for the assignment
 *
 * @param {Object} body HTTP request body
 * @param {Object} session Session object
 */
export const createTaskGroup = async (body, session) => {
    const assignment = await Assignment.findOne({
        where: {
            id: body.assignmentId,
            consumerId: session.consumerId,
            courseId: session.courseId,
        },
    });
    if (assignment) {
        await TaskGroup.create({
            assignmentId: body.assignmentId,
            name: body.name,
            description: body.description || null,
        });
    } else throw new Error('Could not find assignment');
};

/**
 * Set task group
 *
 * @param {int} taskId Task ID
 * @param {int} groupId Group ID
 * @param {int} assignmentId Assignment ID
 */
const setTaskGroup = async (taskId, groupId, assignmentId) => {
    await TaskGroupTasks.destroy({
        where: {
            taskId,
        },
    });
    if (groupId) {
        const group = await TaskGroup.findOne({
            where: {
                id: groupId,
                assignmentId,
            },
        });
        if (group) {
            await TaskGroupTasks.create({
                taskGroupId: groupId,
                taskId,
            });
        }
    }
};

/**
 * Set score and whether to include the task in quiz selections or not
 *
 * @param {int} taskId Task ID
 * @param {Object} body HTTP request body
 * @param {Object} session Session object
 */
export const evaluateTask = async (taskId, body, session) => {
    if (body.score === undefined) body.score = null;
    const tasks = await Task.findAll({
        where: {
            submissionId: body.submissionId,
        },
        include: {
            model: Submission,
            required: true,
            include: {
                model: Assignment,
                where: {
                    status: { [Sequelize.Op.in]: ['FINISHED', 'PUBLISHED_NO_SOLUTION', 'PUBLISHED_WITH_SOLUTION'] },
                    consumerId: session.consumerId,
                    courseId: session.courseId,
                },
                required: true,
            },
        },
    });
    const task = tasks.find((element) => element.id === parseInt(taskId, 10));
    if (task) {
        if (task.submission.status === 'EVALUATED_PUBLISHED' && body.score !== task.score) {
            throw new Error('You cannot change the score of a published submission');
        }
        await Task.update(
            {
                score: body.score,
                status: body.include ? 'EVALUATED_INCLUDE' : 'EVALUATED',
                evaluatedAt: new Date(),
                evaluatedBy: session.userId,
            },
            {
                where: {
                    id: taskId,
                },
            },
        );
        await setTaskGroup(taskId, body.groupId, task.submission.assignment_id);
        const evaluatedTasks = tasks.filter((element) => element.status === 'EVALUATED_INCLUDE' || element.status === 'EVALUATED');
        if (task.submission.status !== 'EVALUATED_PUBLISHED' && (evaluatedTasks.length === tasks.length || evaluatedTasks.length === tasks.length - 1)) {
            let totalScore = parseInt(body.score, 10);
            evaluatedTasks.forEach((element) => {
                if (element.id !== parseInt(taskId, 10)) totalScore += element.score;
            });
            await evaluateTaskSubmission(task.submission, totalScore);
        }
    } else throw new Error('Could not find pending task');
};

/**
 * Delete edit column from a task
 *
 * @param {string} taskId Task ID
 * @param {Object} session Session object
 */
export const deleteTaskEdit = async (taskId, session) => {
    const task = await Task.findByPk(taskId, {
        include: [
            {
                model: Submission,
                required: true,
                include: [
                    {
                        model: Assignment,
                        where: {
                            consumerId: session.consumerId,
                            courseId: session.courseId,
                        },
                        required: true,
                    },
                ],
            },
        ],
    });
    if (task) {
        const removeableMedia = [];
        if (task.edit.mediaId && task.edit.mediaId !== task.mediaId) {
            removeableMedia.push(task.edit.mediaId);
        }
        if (task.type === 'COMBINE_TERMS') {
            const mediaIds = [];
            task.options.forEach((term) => { if (term.type === 'IMAGE') mediaIds.push(term.term); });
            task.edit.options.forEach((term) => {
                if (term.type === 'IMAGE') {
                    const mediaId = mediaIds.find((id) => term.term === id);
                    if (!mediaId) removeableMedia.push(term.term);
                }
            });
        }
        removeUploadedMedia(removeableMedia);
        await task.update({ edit: null });
    } else throw new Error('Could not find task');
};

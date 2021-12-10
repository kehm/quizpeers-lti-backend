import Sequelize from 'sequelize';
import cron from 'cron';
import postgres from '../config/postgres.js';
import Assignment from '../models/Assignment.js';
import AssignmentTasks from '../models/AssignmentTasks.js';
import AssignmentTaskTypes from '../models/AssignmentTaskTypes.js';
import TaskGroupTasks from '../models/TaskGroupTasks.js';
import { getQuizDifficulty } from './quiz.js';
import { logError } from './logger.js';
import { endSubmissions } from './submissions.js';
import { extendTimer, isAssignmentExpired } from './timer.js';

/**
 * Create a new task assignment
 *
 * @param {Object} session Session object
 * @param {Object} body HTTP request body
 * @returns {Object} Assignment
 */
export const createTaskAssignment = async (session, body) => {
    const date = new Date();
    let glossary = [];
    if (body.types.includes('NAME_IMAGE') && !body.glossary) {
        throw new Error('A glossary is required for name image tasks');
    } else if (body.glossary) {
        glossary = [...new Set(body.glossary)];
    } else glossary = null;
    const assignment = await postgres.query(
        'INSERT INTO assignment (consumer_id, course_id, title, assignment_type_name, '
        + 'size, glossary, assignment_status_name, created_by, deadline, created_at, updated_at) '
        + `VALUES (?, ?, ?, ?, ?, ${glossary ? 'ARRAY[?]' : '?'}, ?, ?, ?, ?, ?) `
        + 'RETURNING assignment_id',
        {
            type: Sequelize.QueryTypes.INSERT,
            replacements: [
                session.consumerId,
                session.courseId,
                body.title,
                'TASK_SUBMISSION',
                JSON.stringify(body.size),
                glossary,
                'CREATED',
                session.userId,
                body.deadline,
                date,
                date,
            ],
            model: Assignment,
        },
    );
    const promises = [];
    body.types.forEach((type) => {
        promises.push(AssignmentTaskTypes.create({
            assignmentId: assignment[0][0].assignment_id,
            taskType: type,
        }));
    });
    await Promise.all(promises);
    return assignment;
};

/**
 * Get finished task assignments for the course
 *
 * @param {Object} session Session object
 * @returns {Array} Assignments
 */
export const getTaskAssignments = async (session) => {
    const assignments = await Assignment.findAll({
        where: {
            courseId: session.courseId,
            consumerId: session.consumerId,
            type: 'TASK_SUBMISSION',
            status: { [Sequelize.Op.in]: ['FINISHED', 'PUBLISHED_NO_SOLUTION', 'PUBLISHED_WITH_SOLUTION'] },
        },
        attributes: ['id', 'title', 'status', 'size', 'points', 'deadline', 'created_at'],
    });
    return assignments;
};

/**
 * Calculate fraction and create assignment task
 *
 * @param {int} assignmentId Assignment ID
 * @param {int} taskId Task ID
 * @param {int} index Task index
 * @param {Array} difficulties Difficulties array
 * @param {Object} weights Group weights
 * @param {Object} totalDifficulty Total difficulty (object if weights are given, else int)
 */
const createAssignmentTask = async (
    assignmentId, taskId, index, difficulties, weights, totalDifficulty,
) => {
    let difficulty = 1;
    let weight = 100;
    if (difficulties.length > index) difficulty = difficulties[index];
    if (weights) {
        const group = await TaskGroupTasks.findOne({
            where: {
                taskId,
            },
        });
        totalDifficulty = totalDifficulty[group ? group.taskGroupId : 'null'];
        weight = weights[group ? group.taskGroupId : 'null'];
    }
    await AssignmentTasks.create({
        assignmentId,
        taskId,
        difficulty,
        fraction: (weight / totalDifficulty) * difficulty,
    });
};

/**
 * Create assignment tasks
 *
 * @param {int} assignmentId Assignment ID
 * @param {Object} body Request body
 */
const createAssignmentTasks = async (assignmentId, body) => {
    const totalDifficulty = getQuizDifficulty(body, JSON.parse(body.size));
    const promises = [];
    body.tasks.forEach((taskId, index) => {
        promises.push(createAssignmentTask(
            assignmentId,
            taskId,
            index,
            body.difficulties,
            body.weight ? JSON.parse(body.weight) : undefined,
            totalDifficulty,
        ));
    });
    await Promise.all(promises);
};

/**
 * Create a new task assignment
 *
 * @param {Object} session Session object
 * @param {Object} body HTTP request body
 * @returns {Object} Assignment
 */
export const createQuizAssignment = async (session, body) => {
    const date = new Date();
    let glossary = [];
    const assignments = await Assignment.findAll({
        where: {
            id: { [Sequelize.Op.in]: body.assignments },
            consumerId: session.consumerId,
            courseId: session.courseId,
        },
    });
    assignments.forEach((element) => {
        if (element.glossary) glossary = glossary.concat(element.glossary);
    });
    glossary = [...new Set(glossary)];
    if (glossary.length === 0) glossary = null;
    const assignment = await postgres.query(
        'INSERT INTO assignment (consumer_id, course_id, title, assignment_type_name, size, '
        + 'glossary, timer, assignment_status_name, created_by, deadline, created_at, updated_at) '
        + `VALUES (?, ?, ?, ?, ?, ${glossary ? 'ARRAY[?]' : '?'}, ${body.timer ? 'ARRAY[?]' : '?'}, ?, ?, ?, ?, ?) `
        + 'RETURNING assignment_id',
        {
            type: Sequelize.QueryTypes.INSERT,
            replacements: [
                session.consumerId,
                session.courseId,
                body.title,
                body.type === 'RANDOM' ? 'QUIZ_RANDOM' : 'QUIZ_DEFINITE',
                body.type === 'RANDOM' ? body.size : JSON.stringify(body.tasks.length),
                glossary,
                body.timer || null,
                'CREATED',
                session.userId,
                body.deadline,
                date,
                date,
            ],
            model: Assignment,
        },
    );
    await createAssignmentTasks(assignment[0][0].assignment_id, body);
    return assignment;
};

/**
 * Get student assignment
 *
 * @param {int} id Assignment ID
 * @param {Object} session Session object
 * @returns {Object} Assignment
 */
export const getAssignment = async (id, session) => {
    const assignments = await postgres.query(
        'SELECT assignment.assignment_id, assignment.title, assignment.assignment_type_name, assignment.assignment_status_name, assignment.size, assignment.glossary, '
        + 'assignment.points, assignment.timer, assignment.deadline, assignment.created_at, assignment_task_types.task_type_name FROM assignment '
        + 'LEFT JOIN assignment_task_types '
        + 'ON assignment.assignment_id = assignment_task_types.assignment_id '
        + 'WHERE assignment.assignment_id = ? '
        + 'AND assignment.course_id = ?'
        + 'AND NOT assignment.assignment_status_name = \'CREATED\'',
        {
            type: Sequelize.QueryTypes.SELECT,
            replacements: [id, session.courseId],
            model: Assignment,
            mapToModel: true,
            raw: true,
        },
    );
    if (assignments.length > 0) {
        const assignment = assignments[0];
        if (assignment.type === 'TASK_SUBMISSION') {
            const arr = [];
            assignments.forEach((element) => {
                if (element.task_type_name) arr.push(element.task_type_name);
            });
            delete assignment.task_type_name;
            assignment.taskTypes = arr;
        }
        if (assignment.timer && session.extension) {
            assignment.timer = extendTimer(assignment.timer, session.extension);
        }
        const isExpired = isAssignmentExpired(assignment);
        if (isExpired && assignment.status === 'STARTED') assignment.status = 'FINISHED';
        return assignment;
    }
    return undefined;
};

/**
 * Publish/unpublish quiz solution
 *
 * @param {Object} body HTTP request body
 * @param {Object} session Session object
 */
export const publishSolution = async (assignmentId, session) => {
    const assignment = await Assignment.findOne({
        where: {
            id: assignmentId,
            consumerId: session.consumerId,
            courseId: session.courseId,
        },
    });
    let status;
    if (assignment.status === 'PUBLISHED_NO_SOLUTION') {
        status = 'PUBLISHED_WITH_SOLUTION';
    } else if (assignment.status === 'PUBLISHED_WITH_SOLUTION') {
        status = 'PUBLISHED_NO_SOLUTION';
    }
    if (!status) throw new Error('Assignment results are not published');
    await assignment.update({ status });
};

/**
 * Start the assignment
 *
 * @param {int} assignmentId Assignment ID
 * @param {Object} reqBody Request body
 */
export const startAssignment = async (assignmentId, reqBody) => {
    const assignment = await Assignment.findByPk(assignmentId);
    if (assignment && assignment.status === 'CREATED') {
        await assignment.update({
            outcomeUrl: reqBody.lis_outcome_service_url,
            points: parseFloat(reqBody.custom_canvas_assignment_points_possible),
            status: 'STARTED',
        });
    }
};

/**
 * Update assignment status if deadline is expired
 */
const finishAssignments = async () => {
    try {
        const assignments = await postgres.query(
            'SELECT * FROM assignment '
            + "WHERE assignment.assignment_status_name IN ('CREATED', 'STARTED') "
            + 'AND assignment.deadline < NOW()',
            {
                type: Sequelize.QueryTypes.SELECT,
                model: Assignment,
                mapToModel: true,
                raw: true,
            },
        );
        if (assignments.length > 0) {
            await Assignment.update({
                status: 'FINISHED',
            }, {
                where: {
                    id: { [Sequelize.Op.in]: assignments.map((assignment) => assignment.id) },
                },
            });
            await endSubmissions(assignments);
        }
    } catch (err) {
        logError('Could not finish expired assignments', err);
    }
};

/**
 * Schedule job for ending assignments with expired deadlines
 */
export const endAssignments = async () => new cron.CronJob(`0 */${process.env.END_ASSIGNMENTS_INTERVAL} * * * *`, () => {
    finishAssignments();
}, null, true);

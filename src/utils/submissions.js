import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from '../models/Assignment.js';
import Consumer from '../models/Consumer.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import { publishScore } from './oauth.js';
import {
    calculateQuizScore, getAssignmentTasks, getRandomTasks, shuffleArray,
} from './quiz.js';
import { logError } from './logger.js';
import { getDeadline, isAssignmentExpired, isExpired } from './timer.js';
import Task from '../models/Task.js';

/**
 * Get existing submission for assignment
 *
 * @param {int} assignmentId Assignment ID
 * @param {Object} session Session object
 * @returns {Object} Submission
 */
const getExistingSubmission = async (assignmentId, session) => {
    const submissions = await postgres.query(
        'SELECT submission.submission_id, submission.assignment_id, submission.tasks, submission.submission_status_name, '
        + 'submission.lms_score, submission.submitted_at, submission.created_at, assignment.size, assignment.deadline FROM submission '
        + 'INNER JOIN assignment '
        + 'ON submission.assignment_id = assignment.assignment_id '
        + 'WHERE submission.assignment_id = ? '
        + 'AND submission.quizpeers_user_id = ? '
        + 'AND assignment.consumer_id = ? '
        + 'AND assignment.course_id = ? ',
        {
            type: Sequelize.QueryTypes.SELECT,
            replacements: [assignmentId, session.userId, session.consumerId, session.courseId],
            model: Submission,
            mapToModel: true,
            raw: true,
        },
    );
    if (submissions.length > 0) return submissions[0];
    return undefined;
};

/**
 * Create quiz submission object
 *
 * @param {Object} assignment Assignment
 * @param {Object} session Session object
 */
const createQuizSubmission = async (assignment, session) => {
    let tasks = await getAssignmentTasks(assignment.id);
    if (assignment.type === 'QUIZ_RANDOM') tasks = getRandomTasks(assignment, session.userId, tasks);
    if (!tasks || tasks.length < 1) throw new Error('Could not find any tasks for the assignment');
    tasks.forEach((assignmentTask) => {
        if (assignmentTask.task.type === 'COMBINE_TERMS') {
            shuffleArray(assignmentTask.task.options[0]);
            shuffleArray(assignmentTask.task.options[1]);
        } else shuffleArray(assignmentTask.task.options);
        delete assignmentTask.createdBy;
    });
    await Submission.create({
        assignmentId: assignment.id,
        userId: session.userId,
        tasks,
        returnId: session.returnId,
        status: 'STARTED',
    });
};

/**
 * Create task submission object
 *
 * @param {Object} assignment Assignment
 * @param {Object} session Session object
 */
const createTaskSubmission = async (assignment, session) => {
    await Submission.create({
        assignmentId: assignment.id,
        userId: session.userId,
        returnId: session.role === process.env.ROLE_TEACHER ? '0' : session.returnId,
        status: session.role === process.env.ROLE_TEACHER ? 'EVALUATED_PUBLISHED' : 'STARTED',
    });
};

/**
 * Get existing submission or create new
 *
 * @param {int} assignmentId Assignment ID
 * @param {Object} session Session object
 * @param {boolean} create Create if not exists
 * @param {string} assignmentStatus Required status for the assignment
 * @returns {Object} Submission
 */
export const getSubmission = async (assignmentId, session, create, assignmentStatus) => {
    const assignment = await Assignment.findOne({
        where: {
            id: assignmentId,
            consumerId: session.consumerId,
            courseId: session.courseId,
        },
    });
    let submission;
    if (assignment) {
        if (assignmentStatus) {
            const expired = isAssignmentExpired(assignment);
            if (expired || assignment.status !== assignmentStatus) {
                throw new Error('Invalid assignment status');
            }
        }
        submission = await getExistingSubmission(assignmentId, session);
        if (!submission && create) {
            if (assignment.status === 'STARTED' || session.role === process.env.ROLE_TEACHER) {
                if (assignment.type === 'TASK_SUBMISSION') {
                    await createTaskSubmission(assignment, session);
                } else await createQuizSubmission(assignment, session);
                submission = await getExistingSubmission(assignmentId, session);
            }
        }
        if (submission && assignment.status === 'STARTED' && assignment.timer) {
            submission.deadline = getDeadline(
                submission.created_at,
                submission.deadline,
                assignment.timer,
                session.extension,
            );
            if (isExpired(submission.deadline)) throw new Error('Timer is expired');
        }
    }
    return submission;
};

/**
 * Get quiz tasks with submitted answers
 *
 * @param {string} submissionId Submission ID
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @returns {Array} Submission tasks
 */
export const getQuizTasks = async (submissionId, consumerId, courseId) => {
    const submission = await Submission.findByPk(submissionId, {
        attributes: ['id', 'tasks'],
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
    if (submission) {
        const tasks = await Task.findAll({
            where: {
                id: { [Sequelize.Op.in]: submission.tasks.map((task) => task.task.id) },
            },
        });
        const quizTasks = submission.tasks.map((element) => {
            const task = tasks.find((el) => el.id === element.task.id);
            return ({
                answer: element.answer,
                solution: task.edit ? task.edit.solution : task.solution,
                difficulty: element.difficulty,
                fraction: element.fraction,
                score: element.score,
                task: element.task,
            });
        });
        return quizTasks;
    }
    throw new Error('Could not find submission');
};

/**
 * Get submissions for the assignment that are either pending evaluations or not published
 *
 * @param {int} assignmentId Assignment ID
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @returns {Array} Submissions
 */
export const getPendingSubmissions = async (assignmentId, consumerId, courseId) => {
    const assignment = await Assignment.findOne({
        where: {
            id: assignmentId,
            consumerId,
            courseId,
        },
    });
    if (assignment) {
        if (assignment.status === 'FINISHED') {
            await Submission.update({
                status: 'PENDING',
            }, {
                where: {
                    assignmentId,
                    status: 'STARTED',
                },
            });
        }
        const submissions = await Submission.findAll({
            where: {
                assignmentId,
                status: { [Sequelize.Op.in]: ['PENDING', 'EVALUATED'] },
            },
            attributes: ['id', 'assignment_id', 'status', 'score', 'lms_score', 'submitted_at', 'created_at'],
            include: [
                {
                    model: Assignment,
                    where: {
                        consumerId,
                        courseId,
                    },
                    attributes: ['title', 'type', 'points', 'status', 'deadline'],
                    required: true,
                },
                {
                    model: User,
                    attributes: ['name'],
                },
            ],
        });
        return submissions;
    }
    throw new Error('Assignment does not exist');
};

/**
 * Get submissions with published evaluations
 *
 * @param {int} assignmentId Assignment ID
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @returns {Array} Submissions
 */
export const getPublishedSubmissions = async (assignmentId, consumerId, courseId) => {
    const submissions = await Submission.findAll({
        where: {
            assignmentId,
            status: 'EVALUATED_PUBLISHED',
        },
        attributes: ['id', 'assignment_id', 'status', 'score', 'lms_score', 'submitted_at', 'created_at'],
        include: [
            {
                model: Assignment,
                where: {
                    consumerId,
                    courseId,
                },
                attributes: ['title', 'type', 'points', 'status', 'deadline'],
                required: true,
            },
            {
                model: User,
                attributes: ['name'],
            },
        ],
    });
    return submissions;
};

/**
 * Update task submission score and status
 *
 * @param {Object} submission Submission object
 * @param {float} score Score
 */
export const evaluateTaskSubmission = async (submission, score) => {
    const relativeScore = score / parseInt(process.env.MAX_TASK_SCORE, 10);
    const fraction = submission.assignment.points / parseInt(submission.assignment.size, 10);
    const lmsScore = relativeScore * fraction;
    await Submission.update(
        {
            score,
            lmsScore: Math.round(lmsScore * 100) / 100,
            status: 'EVALUATED',
        },
        {
            where: {
                id: submission.id,
            },
        },
    );
};

/**
 * Change submission status and set timestamp for submission
 *
 * @param {string} submissionId Submission ID
 * @param {Object} session Session object
 */
export const finishSubmission = async (submissionId, session) => {
    await Submission.update({
        status: session.role === process.env.ROLE_TEACHER ? 'EVALUATED_PUBLISHED' : 'PENDING',
        returnId: session.returnId,
        submittedAt: new Date(),
    }, {
        where: {
            id: submissionId,
        },
    });
};

/**
 * Get started submission
 *
 * @param {string} submissionId Submission ID
 * @param {Object} session Session object
 * @param {boolean} force True if force evaluation programmatically
 * @returns {Object} Submission object
 */
export const getStartedSubmission = async (submissionId, session, force) => {
    let submission;
    if (force) {
        submission = await Submission.findOne({
            where: {
                id: submissionId,
                status: 'STARTED',
            },
            include: {
                model: Assignment,
                required: true,
            },
            raw: true,
        });
    } else {
        submission = await Submission.findOne({
            where: {
                id: submissionId,
                userId: session.userId,
            },
            include: {
                model: Assignment,
                where: {
                    consumerId: session.consumerId,
                    courseId: session.courseId,
                },
                required: true,
            },
            raw: true,
        });
    }
    if (!force && submission) {
        if (submission.status !== 'STARTED') throw new Error('Invalid submission status');
        const expired = isAssignmentExpired({
            status: submission['assignment.status'],
            deadline: submission['assignment.deadline'],
        });
        if (expired) throw new Error('Invalid assignment status');
    }
    return submission;
};

/**
 * Save quiz answers
 *
 * @param {Object} submission Submission object
 * @param {Array} answers Tasks with selected answers
 * @param {Object} session Session object
 */
export const saveQuizAnswers = async (submission, answers) => {
    const tasks = [...submission.tasks];
    answers.forEach((answer) => {
        const task = tasks.find((element) => element.task.id === answer.id);
        task.answer = answer.answer;
    });
    await Submission.update({
        tasks,
    }, {
        where: {
            id: submission.id,
        },
    });
};

/**
 * Update tasks in submission object with selected options and achieved score
 *
 * @param {string} submissionId Submission ID
 * @param {boolean} force True if force evaluation programmatically
 */
export const evaluateQuizSubmission = async (submission, force) => {
    const { score, lmsScore, tasks } = await calculateQuizScore(submission);
    await Submission.update({
        submittedAt: force ? null : new Date(),
        status: 'EVALUATED',
        score,
        lmsScore,
        tasks,
    }, {
        where: {
            id: submission.id,
        },
    });
};

/**
 * Publish result to LMS and update submission object status
 *
 * @param {Object} submission Submission object
 * @param {string} outcomeUrl Outcome URL
 * @param {Object} consumer Consumer object
 * @param {string} publishedBy User ID
 */
const publishResult = async (submission, outcomeUrl, consumer, publishedBy) => {
    await publishScore(
        consumer,
        submission.lmsScore,
        submission.returnId,
        outcomeUrl,
    );
    await submission.update({
        status: 'EVALUATED_PUBLISHED',
        publishedAt: new Date(),
        publishedBy,
    });
};

/**
 * If all submissions have been published, update assignment status
 *
 * @param {int} assignmentId Assignment ID
 * @param {Object} session Session object
 */
const checkSubmissionsPublished = async (assignmentId, session) => {
    const submissions = await Submission.findAll({
        where: {
            assignmentId,
        },
    });
    const published = submissions.filter((submission) => submission.status === 'EVALUATED_PUBLISHED');
    if (published.length === submissions.length) {
        await Assignment.update({
            status: 'PUBLISHED_NO_SOLUTION',
        }, {
            where: {
                id: assignmentId,
                consumerId: session.consumerId,
                courseId: session.courseId,
            },
        });
    }
};

/**
 * Publish the selected submissions
 *
 * @param {int} assignmentId Assignment ID
 * @param {Array} submissions Submission IDs
 * @param {Object} session Session object
 */
export const publishSubmissionResults = async (assignmentId, submissions, session) => {
    const consumer = await Consumer.findOne({
        where: {
            id: session.consumerId,
            status: 'ACTIVE',
        },
    });
    if (consumer) {
        const assignment = await Assignment.findOne({
            where: {
                id: assignmentId,
                consumerId: session.consumerId,
                courseId: session.courseId,
            },
        });
        if (assignment) {
            const evaluatedSubmissions = await Submission.findAll({
                where: {
                    id: { [Sequelize.Op.in]: submissions },
                    status: 'EVALUATED',
                },
                include: {
                    model: Assignment,
                    where: {
                        id: assignmentId,
                        consumerId: session.consumerId,
                        courseId: session.courseId,
                    },
                    required: true,
                },
            });
            if (evaluatedSubmissions.length === submissions.length) {
                const promises = [];
                evaluatedSubmissions.forEach((submission) => {
                    promises.push(publishResult(
                        submission,
                        assignment.outcomeUrl,
                        consumer,
                        session.userId,
                    ));
                });
                await Promise.all(promises);
                await checkSubmissionsPublished(assignmentId, session);
            } else throw new Error('Submissions must be evaluated before the result can be published');
        } else throw new Error('Could not find assignment');
    } else throw new Error('Consumer is not registered');
};

/**
 * End expired task submissions
 *
 * @param {Array} assignments Assignment IDs
 */
const endTaskSubmissions = async (assignments) => {
    await Submission.update({
        status: 'PENDING',
    }, {
        where: {
            assignmentId: { [Sequelize.Op.in]: assignments },
            status: 'STARTED',
        },
    });
};

/**
 * Forcefully end quiz submission
 *
 * @param {string} submissionId Submission ID
 */
const endQuizSubmission = async (submissionId) => {
    const submission = await getStartedSubmission(submissionId, undefined, true);
    if (submission) {
        await evaluateQuizSubmission(submission, true);
    } else throw new Error('Could not find started submission');
};

/**
 * End expired quiz submissions
 *
 * @param {Array} assignments Assignment IDs
 */
const endQuizSubmissions = async (assignments) => {
    try {
        const submissions = await Submission.findAll({
            where: {
                assignmentId: { [Sequelize.Op.in]: assignments },
                status: 'STARTED',
            },
        });
        const promises = [];
        submissions.forEach((submission) => {
            promises.push(endQuizSubmission(submission.id));
        });
        await Promise.all(promises);
    } catch (err) {
        logError('Could not end quiz submissions', err);
    }
};

/**
 * Finish started (i.e. not submitted) task submissions that belongs to an expired assignment
 *
 * @param {Array} assignments Assignment objects
 */
export const endSubmissions = async (assignments) => {
    try {
        const taskAssignments = assignments.filter((assignment) => assignment.type === 'TASK_SUBMISSION');
        const quizAssignments = assignments.filter((assignment) => assignment.type === 'QUIZ_DEFINITE' || assignment.type === 'QUIZ_RANDOM');
        if (taskAssignments.length > 0) {
            endTaskSubmissions(taskAssignments.map((assignment) => assignment.id));
        }
        if (quizAssignments.length > 0) {
            endQuizSubmissions(quizAssignments.map((assignment) => assignment.id));
        }
    } catch (err) {
        logError('Could not end submissions', err);
    }
};

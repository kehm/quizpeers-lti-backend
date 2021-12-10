import Sequelize from 'sequelize';
import AssignmentType from '../models/AssignmentType.js';
import TaskType from '../models/TaskType.js';
import Assignment from '../models/Assignment.js';
import AssignmentTasks from '../models/AssignmentTasks.js';
import AssignmentTaskTypes from '../models/AssignmentTaskTypes.js';
import Consumer from '../models/Consumer.js';
import Submission from '../models/Submission.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Nonce from '../models/Nonce.js';
import Session from '../models/Session.js';
import postgres from '../config/postgres.js';
import TaskStatus from '../models/TaskStatus.js';
import AssignmentStatus from '../models/AssignmentStatus.js';
import ConsumerStatus from '../models/ConsumerStatus.js';
import SubmissionStatus from '../models/SubmissionStatus.js';
import Media from '../models/Media.js';
import MediaType from '../models/MediaType.js';
import {
    defaultAssignmentStatus, defaultAssignmentTypes, defaultConsumerStatus,
    defaultMediaTypes, defaultSubmissionStatus, defaultTaskStatus, defaultTaskTypes,
} from './db-defaults.js';
import TaskGroup from '../models/TaskGroup.js';
import TaskGroupTasks from '../models/TaskGroupTasks.js';

/**
 * Initialize default values in tables
 */
const initDefaults = async () => {
    const promises = [];
    defaultMediaTypes.forEach((type) => {
        promises.push(MediaType.findOrCreate({
            where: {
                name: type.name,
            },
            defaults: type,
        }));
    });
    defaultAssignmentTypes.forEach((type) => {
        promises.push(AssignmentType.findOrCreate({
            where: {
                name: type.name,
            },
            defaults: type,
        }));
    });
    defaultTaskTypes.forEach((type) => {
        promises.push(TaskType.findOrCreate({
            where: {
                name: type.name,
            },
            defaults: type,
        }));
    });
    defaultAssignmentStatus.forEach((status) => {
        promises.push(AssignmentStatus.findOrCreate({
            where: {
                name: status.name,
            },
            defaults: status,
        }));
    });
    defaultConsumerStatus.forEach((status) => {
        promises.push(ConsumerStatus.findOrCreate({
            where: {
                name: status.name,
            },
            defaults: status,
        }));
    });
    defaultSubmissionStatus.forEach((status) => {
        promises.push(SubmissionStatus.findOrCreate({
            where: {
                name: status.name,
            },
            defaults: status,
        }));
    });
    defaultTaskStatus.forEach((status) => {
        promises.push(TaskStatus.findOrCreate({
            where: {
                name: status.name,
            },
            defaults: status,
        }));
    });
    await Promise.all(promises);
};

/**
 * Initialize table associations
 */
const initAssociations = async () => {
    const promises = [];
    promises.push(Submission.belongsTo(Assignment, { foreignKey: { name: 'assignment_id' } }));
    promises.push(Assignment.hasOne(Submission, { foreignKey: { name: 'assignment_id' } }));
    promises.push(Task.belongsTo(Media, { foreignKey: { name: 'media_id' } }));
    promises.push(Media.hasOne(Task, { foreignKey: { name: 'media_id' } }));
    promises.push(Task.belongsTo(Submission, { foreignKey: { name: 'submission_id' } }));
    promises.push(Submission.hasOne(Task, { foreignKey: { name: 'submission_id' } }));
    promises.push(Submission.belongsTo(User, { foreignKey: { name: 'quizpeers_user_id' } }));
    promises.push(User.hasOne(Submission, { foreignKey: { name: 'quizpeers_user_id' } }));
    promises.push(TaskGroupTasks.belongsTo(Task, { foreignKey: { name: 'task_id' } }));
    promises.push(Task.hasOne(TaskGroupTasks, { foreignKey: { name: 'task_id' } }));
    promises.push(AssignmentTasks.belongsTo(Task, { foreignKey: { name: 'task_id' } }));
    promises.push(Task.hasOne(AssignmentTasks, { foreignKey: { name: 'task_id' } }));
    promises.push(TaskGroup.belongsTo(Assignment, { foreignKey: { name: 'assignment_id' } }));
    promises.push(Assignment.hasOne(TaskGroup, { foreignKey: { name: 'assignment_id' } }));
    await Promise.all(promises);
};

/**
 * Sync and populate tables
 */
const initPostgres = async () => {
    if (process.env.POSTGRES_INIT === 'true') {
        await postgres.sync({ force: process.env.POSTGRES_FORCE === 'true' });
        await initDefaults();
        if (process.env.POSTGRES_FORCE === 'true') {
            postgres.query('ALTER SEQUENCE media_media_id_seq RESTART WITH 10000;');
        }
    }
    await initAssociations();
};

export default initPostgres;

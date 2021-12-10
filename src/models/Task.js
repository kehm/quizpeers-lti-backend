import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Media from './Media.js';
import Submission from './Submission.js';
import TaskStatus from './TaskStatus.js';
import TaskType from './TaskType.js';
import User from './User.js';

/**
 * Define table for tasks
 */
const Task = postgres.define('task', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'task_id',
        autoIncrement: true,
    },
    title: {
        type: Sequelize.STRING(60),
        field: 'title',
        allowNull: false,
    },
    description: {
        type: Sequelize.TEXT,
        field: 'description',
        allowNull: false,
    },
    mediaId: {
        type: Sequelize.INTEGER,
        field: 'media_id',
        allowNull: true,
        references: {
            model: Media,
            key: 'media_id',
        },
    },
    type: {
        type: Sequelize.STRING(30),
        field: 'task_type_name',
        allowNull: false,
        references: {
            model: TaskType,
            key: 'task_type_name',
        },
    },
    options: {
        type: Sequelize.JSONB,
        allowNull: true,
        field: 'options',
    },
    solution: {
        type: Sequelize.JSONB,
        field: 'solution',
        allowNull: true,
    },
    edit: {
        type: Sequelize.JSONB,
        field: 'edit',
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING(30),
        field: 'task_status_name',
        allowNull: false,
        references: {
            model: TaskStatus,
            key: 'task_status_name',
        },
    },
    submissionId: {
        type: Sequelize.UUID,
        field: 'submission_id',
        allowNull: false,
        references: {
            model: Submission,
            key: 'submission_id',
        },
    },
    score: {
        type: Sequelize.FLOAT,
        field: 'score',
        allowNull: true,
    },
    evaluatedAt: {
        type: Sequelize.DATE,
        field: 'evaluated_at',
        allowNull: true,
    },
    evaluatedBy: {
        type: Sequelize.UUID,
        field: 'evaluated_by',
        allowNull: true,
        references: {
            model: User,
            key: 'quizpeers_user_id',
        },
    },
}, {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default Task;

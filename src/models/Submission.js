import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from './Assignment.js';
import SubmissionStatus from './SubmissionStatus.js';
import User from './User.js';

/**
 * Define table for submission
 */
const Submission = postgres.define('submission', {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        field: 'submission_id',
        defaultValue: Sequelize.UUIDV4,
    },
    assignmentId: {
        type: Sequelize.INTEGER,
        field: 'assignment_id',
        allowNull: false,
        references: {
            model: Assignment,
            key: 'assignment_id',
        },
    },
    score: {
        type: Sequelize.FLOAT,
        field: 'score',
        allowNull: true,
    },
    lmsScore: {
        type: Sequelize.FLOAT,
        field: 'lms_score',
        allowNull: true,
    },
    tasks: {
        type: Sequelize.JSONB,
        field: 'tasks',
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING(30),
        field: 'submission_status_name',
        allowNull: false,
        references: {
            model: SubmissionStatus,
            key: 'submission_status_name',
        },
    },
    userId: {
        type: Sequelize.UUID,
        field: 'quizpeers_user_id',
        allowNull: true,
        references: {
            model: User,
            key: 'quizpeers_user_id',
        },
    },
    returnId: {
        type: Sequelize.STRING(255),
        field: 'return_id',
        allowNull: false,
    },
    submittedAt: {
        type: Sequelize.DATE,
        field: 'submitted_at',
        allowNull: true,
    },
    publishedAt: {
        type: Sequelize.DATE,
        field: 'published_at',
        allowNull: true,
    },
    publishedBy: {
        type: Sequelize.UUID,
        field: 'published_by',
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

export default Submission;

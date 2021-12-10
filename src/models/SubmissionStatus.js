import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for submission status
 */
const SubmissionStatus = postgres.define('submission_status', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'submission_status_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default SubmissionStatus;

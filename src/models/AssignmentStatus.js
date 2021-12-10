import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for assignment status
 */
const AssignmentStatus = postgres.define('assignment_status', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'assignment_status_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default AssignmentStatus;

import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for assignment types (TASK, QUIZ)
 */
const AssignmentType = postgres.define('assignment_type', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'assignment_type_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default AssignmentType;

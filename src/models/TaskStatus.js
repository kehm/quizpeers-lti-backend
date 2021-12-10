import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for task status
 */
const TaskStatus = postgres.define('task_status', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'task_status_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default TaskStatus;

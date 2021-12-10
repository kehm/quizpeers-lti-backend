import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for task types (MULITPLE_CHOICE, COMBINE_TERMS)
 */
const TaskType = postgres.define('task_type', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'task_type_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default TaskType;

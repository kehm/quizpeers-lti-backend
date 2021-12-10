import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from './Assignment.js';

/**
 * Define table for task groups
 */
const TaskGroup = postgres.define('task_group', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'task_group_id',
        autoIncrement: true,
    },
    name: {
        type: Sequelize.STRING(30),
        field: 'name',
        allowNull: false,
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: true,
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
}, {
    timestamps: false,
});

export default TaskGroup;

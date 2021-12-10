import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from './Assignment.js';
import Task from './Task.js';

/**
 * Define table for tasks in an assignment
 */
const AssignmentTasks = postgres.define('assignment_tasks', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'assignment_tasks_id',
        autoIncrement: true,
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
    taskId: {
        type: Sequelize.INTEGER,
        field: 'task_id',
        allowNull: false,
        references: {
            model: Task,
            key: 'task_id',
        },
    },
    difficulty: {
        type: Sequelize.INTEGER,
        field: 'difficulty',
        allowNull: false,
    },
    fraction: {
        type: Sequelize.FLOAT,
        field: 'fraction',
        allowNull: true,
    },
}, {
    timestamps: false,
});

export default AssignmentTasks;

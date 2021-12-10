import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Assignment from './Assignment.js';
import TaskType from './TaskType.js';

/**
 * Define table for accepted task types in a task assignment
 */
const AssignmentTaskTypes = postgres.define('assignment_task_types', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'assignment_task_types_id',
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
    taskType: {
        type: Sequelize.STRING(30),
        field: 'task_type_name',
        allowNull: false,
        references: {
            model: TaskType,
            key: 'task_type_name',
        },
    },
}, {
    timestamps: false,
});

export default AssignmentTaskTypes;

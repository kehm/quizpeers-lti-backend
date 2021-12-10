import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Task from './Task.js';
import TaskGroup from './TaskGroup.js';

/**
 * Define table for task group tasks
 */
const TaskGroupTasks = postgres.define('task_group_tasks', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'task_group_tasks_id',
        autoIncrement: true,
    },
    taskGroupId: {
        type: Sequelize.INTEGER,
        field: 'task_group_id',
        allowNull: false,
        references: {
            model: TaskGroup,
            key: 'task_group_id',
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
}, {
    timestamps: false,
});

export default TaskGroupTasks;

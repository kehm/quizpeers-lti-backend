import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import AssignmentStatus from './AssignmentStatus.js';
import AssignmentType from './AssignmentType.js';
import Consumer from './Consumer.js';
import User from './User.js';

/**
 * Define table for assignment
 */
const Assignment = postgres.define('assignment', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        field: 'assignment_id',
        autoIncrement: true,
    },
    consumerId: {
        type: Sequelize.STRING(255),
        field: 'consumer_id',
        allowNull: false,
        references: {
            model: Consumer,
            key: 'consumer_id',
        },
    },
    courseId: {
        type: Sequelize.STRING(255),
        allowNull: false,
        field: 'course_id',
    },
    title: {
        type: Sequelize.STRING(60),
        field: 'title',
        allowNull: false,
    },
    type: {
        type: Sequelize.STRING(30),
        field: 'assignment_type_name',
        allowNull: false,
        references: {
            model: AssignmentType,
            key: 'assignment_type_name',
        },
    },
    size: {
        type: Sequelize.JSONB,
        field: 'size',
        allowNull: true,
    },
    glossary: {
        type: Sequelize.ARRAY(Sequelize.STRING(60)),
        field: 'glossary',
        allowNull: true,
    },
    points: {
        type: Sequelize.INTEGER,
        field: 'points',
        allowNull: true,
    },
    timer: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        field: 'timer',
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING(30),
        field: 'assignment_status_name',
        allowNull: false,
        references: {
            model: AssignmentStatus,
            key: 'assignment_status_name',
        },
    },
    outcomeUrl: {
        type: Sequelize.STRING(255),
        field: 'outcome_url',
        allowNull: true,
    },
    createdBy: {
        type: Sequelize.UUID,
        field: 'created_by',
        allowNull: true,
        references: {
            model: User,
            key: 'quizpeers_user_id',
        },
    },
    deadline: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'deadline',
    },
}, {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default Assignment;

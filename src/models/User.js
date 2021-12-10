import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import Consumer from './Consumer.js';

/**
 * Define table for users
 */
const User = postgres.define('quizpeers_user', {
    id: {
        type: Sequelize.UUID,
        primaryKey: true,
        field: 'quizpeers_user_id',
        defaultValue: Sequelize.UUIDV4,
    },
    lmsId: {
        type: Sequelize.STRING(255),
        field: 'lms_id',
        allowNull: false,
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
    name: {
        type: Sequelize.STRING(255),
        field: 'full_name',
        allowNull: true,
    },
    extendDeadlineMins: {
        type: Sequelize.SMALLINT,
        field: 'extend_deadline_mins',
        allowNull: true,
    },
}, {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default User;

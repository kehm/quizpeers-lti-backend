import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';
import ConsumerStatus from './ConsumerStatus.js';

/**
 * Define table for consumers
 */
const Consumer = postgres.define('consumer', {
    id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        field: 'consumer_id',
    },
    key: {
        type: Sequelize.STRING(255),
        field: 'consumer_key',
        allowNull: false,
    },
    secret: {
        type: Sequelize.STRING(255),
        field: 'consumer_secret',
        allowNull: false,
    },
    name: {
        type: Sequelize.STRING(255),
        field: 'name',
        allowNull: true,
    },
    shortName: {
        type: Sequelize.STRING(30),
        field: 'short_name',
        allowNull: true,
    },
    status: {
        type: Sequelize.STRING(30),
        field: 'consumer_status_name',
        allowNull: false,
        references: {
            model: ConsumerStatus,
            key: 'consumer_status_name',
        },
    },
}, {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default Consumer;

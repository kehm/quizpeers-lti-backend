import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for consumer status
 */
const ConsumerStatus = postgres.define('consumer_status', {
    name: {
        type: Sequelize.STRING(30),
        primaryKey: true,
        field: 'consumer_status_name',
    },
    description: {
        type: Sequelize.STRING(60),
        field: 'description',
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default ConsumerStatus;

import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table for oauth nonces
 */
const Nonce = postgres.define('oauth_nonce', {
    nonce: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        field: 'nonce',
    },
    timestamp: {
        type: Sequelize.BIGINT,
        field: 'timestamp',
        allowNull: false,
    },
});

export default Nonce;

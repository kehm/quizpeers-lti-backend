import Sequelize from 'sequelize';
import postgres from '../config/postgres.js';

/**
 * Define table named session
 */
const Session = postgres.define('session', {
    sid: {
        type: Sequelize.STRING,
        primaryKey: true,
    },
    userId: Sequelize.STRING,
    expires: Sequelize.DATE,
    data: Sequelize.TEXT,
});

export default Session;

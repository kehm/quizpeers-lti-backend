import 'dotenv/config.js';
import express from 'express';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import cors from 'cors';
import helmet from 'helmet';
import postgres from './config/postgres.js';
import assignmentsRoute from './routes/assignments.js';
import submissionsRoute from './routes/submissions.js';
import tasksRoute from './routes/tasks.js';
import mediaRoute from './routes/media.js';
import launchRoute from './routes/launch.js';
import authRoute from './routes/auth.js';
import { nonceCleanup } from './utils/oauth.js';
import initPostgres from './utils/init-postgres.js';
import { logError, logInfo } from './utils/logger.js';
import { endAssignments } from './utils/assignments.js';

/**
 * Application entry point
 */
const app = express();

// Configure session table
const SequelizeStore = connectSessionSequelize(session.Store);
const store = new SequelizeStore({
    db: postgres,
    table: 'session',
    extendDefaultFields: (defaults, session) => {
        const extension = {
            data: defaults.data,
            expires: defaults.expires,
            userId: session.userId,
        };
        return extension;
    },
    checkExpirationInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL, 10),
    expiration: parseInt(process.env.SESSION_EXPIRES, 10),
});

// Initialize middleware
app.use(session({
    name: process.env.SESSION_NAME,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    /*  cookie: {
     maxAge: process.env.SESSION_MAX_AGE,
       sameSite: true,
     secure: true
    } */
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `default-src 'self';base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;frame-ancestors 'self' ${process.env.LMS_URL};img-src 'self' data:;object-src 'none';script-src 'self';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests`);
    next();
});

// Create routes
app.use('/assignments', assignmentsRoute);
app.use('/submissions', submissionsRoute);
app.use('/tasks', tasksRoute);
app.use('/media', mediaRoute);
app.use('/launch', launchRoute);
app.use('/auth', authRoute);

/**
 * Check database connection and start listening
 */
const run = async () => {
    try {
        await postgres.authenticate();
        await initPostgres();
        app.listen(process.env.PORT, () => logInfo(`Server started on port ${process.env.PORT}`));
        nonceCleanup();
        endAssignments();
    } catch (err) {
        logError('PostgreSQL connection failed', err);
    }
};

run();

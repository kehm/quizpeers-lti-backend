import express from 'express';
import checkAPIs from 'express-validator';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '../middleware/auth.js';
import isValidInput from '../middleware/input.js';
import Media from '../models/Media.js';
import { logError } from '../utils/logger.js';

const router = express.Router();
const { param } = checkAPIs;

/**
 * Get media file
 */
router.get('/:mediaId', isAuthenticated, [
    param('mediaId').isInt(),
], isValidInput, async (req, res) => {
    try {
        const media = await Media.findByPk(req.params.mediaId);
        if (media && media.filePath) {
            if (fs.existsSync(media.filePath)) {
                const resolvedPath = path.resolve(media.filePath);
                res.sendFile(resolvedPath);
            } else {
                logError('File path does not exist');
                res.sendStatus(500);
            }
        } else res.sendStatus(404);
    } catch (err) {
        logError('Could not get media file', err);
        res.sendStatus(500);
    }
});

/**
 * Get media file thumbnail
 */
router.get('/thumbnails/:mediaId', isAuthenticated, [
    param('mediaId').isInt(),
], isValidInput, async (req, res) => {
    try {
        const media = await Media.findByPk(req.params.mediaId);
        if (media && media.thumbnailPath) {
            if (fs.existsSync(media.thumbnailPath)) {
                const resolvedPath = path.resolve(media.thumbnailPath);
                res.sendFile(resolvedPath);
            } else {
                logError('File path does not exist');
                res.sendStatus(500);
            }
        } else res.sendStatus(404);
    } catch (err) {
        logError('Could not get media file thumbnail', err);
        res.sendStatus(500);
    }
});

export default router;

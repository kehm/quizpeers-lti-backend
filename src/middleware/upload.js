import path from 'path';
import multer from 'multer';
import { logError } from '../utils/logger.js';
import { createMedia } from '../utils/media.js';

// Set storage engine
const storage = multer.diskStorage({
    destination: process.env.MEDIA_PATH,
    filename: (req, file, cb) => {
        cb(null, file.mediaFileName);
    },
});

/**
 * Validate file extension and mime type
 *
 * @param {Object} file File
 */
const validateFileType = (file) => {
    const types = new RegExp('jpg|jpeg|png');
    const mimes = new RegExp('image/jpeg|image/png');
    const ext = types.test(path.extname(file.originalname).toLowerCase());
    const mime = mimes.test(file.mimetype);
    if (ext && mime) return;
    throw new Error('Error: Invalid file type');
};

/**
 * Validate file and create media
 *
 * @param {Object} req Http request
 * @param {Object} file File
 * @param {Object} cb Callback
 */
const validateAndCreate = async (req, file, cb) => {
    try {
        await validateFileType(file);
        const { mediaId, fileName } = await createMedia(
            file.mimetype,
            req.session.userId,
            req.session.consumerId,
            req.session.courseId,
        );
        file.mediaFileName = fileName;
        if (req.locals && req.locals.mediaIds) {
            req.locals.mediaIds.push(mediaId);
        } else req.locals = { mediaIds: [mediaId] };
        cb(null, true);
    } catch (err) {
        logError('Could not validate or create media', err);
        cb('ERROR: Could not validate or create media');
    }
};

// Set upload config
const config = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) },
    fileFilter: (req, file, cb) => validateAndCreate(req, file, cb),
}).array('files');

/**
 * Save file
 */
const upload = (req, res, next) => {
    config(req, res, (err) => {
        if (err) {
            logError('Could not handle file upload', err);
            res.sendStatus(500);
        } else next();
    });
};

export default upload;

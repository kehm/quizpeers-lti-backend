import { validationResult } from 'express-validator';
import { removeUploadedMedia } from '../utils/media.js';

/**
 * Check if input is valid
 */
const isValidInput = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        next();
    } else {
        removeUploadedMedia(req.locals && req.locals.mediaIds);
        res.status(400).json({ errors: errors.array() });
    }
};

export default isValidInput;

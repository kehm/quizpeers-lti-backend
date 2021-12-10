import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import Media from '../models/Media.js';
import { logError } from './logger.js';

/**
 * Resize image file
 *
 * @param {Object} file Image file
 * @param {int} width Width in pixels
 * @param {int} height Height in pixels
 * @param {int} quality Quality
 * @param {string} newName New file ending (to distinguish from existing file)
 */
const resizeImage = (file, width, height, quality, newName) => new Promise((resolve, reject) => {
    const name = file.filename.split('.')[0];
    Media.findOne({ where: { fileName: file.filename } }).then((media) => {
        if (media) {
            switch (file.mimetype) {
                case 'image/jpeg':
                    sharp(file.path)
                        .resize(width, height)
                        .jpeg({ quality })
                        .toFile(path.resolve(file.destination, `${name}-${newName}.jpeg`))
                        .then(() => {
                            media.update({
                                thumbnailName: `${name}-${newName}.jpeg`,
                                thumbnailPath: `${file.destination}/${name}-${newName}.jpeg`,
                            }).then(() => {
                                resolve();
                            }).catch((err) => reject(err));
                        })
                        .catch((err) => reject(err));
                    break;
                case 'image/png':
                    sharp(file.path)
                        .resize(width, height)
                        .png({ quality })
                        .toFile(path.resolve(file.destination, `${name}-${newName}.png`))
                        .then(() => {
                            media.update({
                                thumbnailName: `${name}-${newName}.png`,
                                thumbnailPath: `${file.destination}/${name}-${newName}.png`,
                            }).then(() => {
                                resolve();
                            }).catch((err) => reject(err));
                        })
                        .catch((err) => reject(err));
                    break;
                default:
                    reject();
                    break;
            }
        } else reject();
    }).catch((err) => reject(err));
});

/**
 * Resize image files
 *
 * @param {Array} files Image files
 * @param {int} width Width in pixels
 * @param {int} height Height in pixels
 * @param {int} quality Quality
 * @param {string} newName New file ending (to distinguish from existing file)
 */
export const resizeImages = async (files, width, height, quality, newName) => {
    if (files && files.length > 0) {
        const promises = [];
        files.forEach((file) => {
            promises.push(resizeImage(file, width, height, quality, newName));
        });
        await Promise.all(promises);
    }
};

/**
 * Create media entry
 *
 * @param {string} userId User ID
 * @param {string} consumerId Consumer ID
 * @param {string} courseId Course ID
 * @returns {string} Media ID and file name
 */
export const createMedia = async (type, userId, consumerId, courseId) => {
    const media = await Media.create({
        type,
        createdBy: userId,
        consumerId,
        courseId,
    });
    const fileName = `${media.id}.${media.type.split('/')[1]}`;
    await media.update({
        fileName,
        filePath: `${process.env.MEDIA_PATH}/${fileName}`,
    });
    return { mediaId: media.id, fileName };
};

/**
 * Remove media from table and disk
 *
 * @param {int} id Media ID
 */
export const removeMedia = async (id) => {
    const media = await Media.findByPk(id);
    const promises = [];
    if (media.filePath) {
        promises.push(new Promise((resolve, reject) => {
            fs.unlink(media.filePath, (err) => {
                if (err && err.code === 'ENOENT') {
                    reject(err); // File does not exist
                } else if (err) {
                    reject(err);
                } else resolve();
            });
        }));
    }
    if (media.thumbnailPath) {
        promises.push(new Promise((resolve, reject) => {
            fs.unlink(media.thumbnailPath, (err) => {
                if (err && err.code === 'ENOENT') {
                    reject(err); // File does not exist
                } else if (err) {
                    reject(err);
                } else resolve();
            });
        }));
    }
    await Promise.all(promises);
    await media.destroy();
};

/**
 * Remove uploaded media
 *
 * @param {int} mediaId MediaId
 */
const removeUpload = async (mediaId) => {
    try {
        await removeMedia(mediaId);
    } catch (errRemove) {
        logError(`Could not remove uploaded media with ID ${mediaId}`, errRemove);
    }
};

/**
 * Remove uploaded media files
 *
 * @param {Array} mediaIds Media IDs to remove
 */
export const removeUploadedMedia = async (mediaIds) => {
    if (mediaIds && mediaIds.length > 0) {
        mediaIds.forEach((mediaId) => removeUpload(mediaId));
    }
};

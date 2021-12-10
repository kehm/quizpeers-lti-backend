import express from 'express';
import checkAPIs from 'express-validator';
import url from 'url';
import path from 'path';
import pkg from 'oauth-sign';
import {
    getAssignmentParams, getConsumer, getResourceParams, setUser,
} from '../utils/oauth.js';
import { isAuthenticated, isInstructor } from '../middleware/auth.js';
import isValidInput from '../middleware/input.js';
import { logError } from '../utils/logger.js';
import { startAssignment } from '../utils/assignments.js';

const router = express.Router();
const { body } = checkAPIs;
const { hmacsign } = pkg;

/**
 * Get LTI xml config
 */
router.get('/config.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(process.cwd(), 'config', 'config.xml'));
});

/**
 * Launch LTI resource
 * Body: LTI launch parameters
 */
router.post('/', [
    body('context_id').notEmpty(),
    body('context_label').notEmpty(),
    body('context_title').notEmpty(),
    body('custom_canvas_enrollment_state').notEmpty(),
    body('ext_content_intended_use').equals('navigation'),
    body('ext_content_return_types').equals('lti_launch_url'),
    body('ext_content_return_url').notEmpty(),
    body('ext_roles').notEmpty(),
    body('launch_presentation_document_target').notEmpty(),
    body('launch_presentation_height').notEmpty(),
    body('launch_presentation_locale').notEmpty(),
    body('launch_presentation_return_url').notEmpty(),
    body('launch_presentation_width').notEmpty(),
    body('lis_person_name_family').notEmpty(),
    body('lis_person_name_given').notEmpty(),
    body('lis_person_name_full').notEmpty(),
    body('lti_message_type').equals('basic-lti-launch-request'),
    body('lti_version').notEmpty(),
    body('oauth_callback').notEmpty(),
    body('oauth_consumer_key').notEmpty(),
    body('oauth_nonce').notEmpty(),
    body('oauth_signature_method').equals('HMAC-SHA1'),
    body('oauth_timestamp').notEmpty(),
    body('oauth_version').equals('1.0'),
    body('resource_link_id').notEmpty(),
    body('resource_link_title').notEmpty(),
    body('roles').equals(process.env.ROLE_TEACHER),
    body('selection_directive').notEmpty(),
    body('tool_consumer_info_product_family_code').equals('canvas'),
    body('tool_consumer_info_version').notEmpty(),
    body('tool_consumer_instance_contact_email').notEmpty(),
    body('tool_consumer_instance_guid').notEmpty(),
    body('tool_consumer_instance_name').notEmpty(),
    body('user_id').notEmpty(),
    body('oauth_signature').notEmpty(),
], isValidInput, async (req, res) => {
    try {
        const consumer = await getConsumer(req.body);
        const sign = hmacsign(
            'POST',
            'https://quizpeers.uib.no/api/launch',
            getResourceParams(req.body),
            consumer.secret,
        );
        if (sign === req.body.oauth_signature) {
            try {
                await setUser(req);
                res.redirect(url.format({
                    pathname: '/create',
                    query: {
                        'lang': req.body.launch_presentation_locale,
                        'points:': req.body.custom_canvas_assignment_points_possible,
                    },
                }));
            } catch (err) {
                logError('Could not set user object', err);
                res.sendStatus(500);
            }
        } else res.status(403).json({ message: 'Invalid Oauth signature' });
    } catch (err) {
        logError('Could not validate the request', err);
        res.sendStatus(403);
    }
});

/**
 * Launch LTI assignment
 * Body: LTI launch parameters
 */
router.post('/assignment/:id', [
    body('context_id').notEmpty(),
    body('context_label').notEmpty(),
    body('context_title').notEmpty(),
    body('custom_canvas_assignment_points_possible').isNumeric(),
    body('custom_canvas_assignment_title').notEmpty(),
    body('custom_canvas_enrollment_state').notEmpty(),
    body('ext_ims_lis_basic_outcome_url').notEmpty(),
    body('ext_lti_assignment_id').notEmpty(),
    body('ext_outcome_data_values_accepted').notEmpty(),
    body('ext_outcome_result_total_score_accepted').notEmpty(),
    body('ext_outcome_submission_submitted_at_accepted').notEmpty(),
    body('ext_outcomes_tool_placement_url').notEmpty(),
    body('ext_roles').notEmpty(),
    body('launch_presentation_document_target').notEmpty(),
    body('launch_presentation_locale').notEmpty(),
    body('launch_presentation_return_url').notEmpty(),
    body('lis_outcome_service_url').notEmpty(),
    body('lis_person_name_family').notEmpty(),
    body('lis_person_name_given').notEmpty(),
    body('lis_person_name_full').notEmpty(),
    body('lis_result_sourcedid').notEmpty().optional(),
    body('lti_message_type').equals('basic-lti-launch-request'),
    body('lti_version').notEmpty(),
    body('oauth_callback').notEmpty(),
    body('oauth_consumer_key').notEmpty(),
    body('oauth_nonce').notEmpty(),
    body('oauth_signature_method').equals('HMAC-SHA1'),
    body('oauth_timestamp').notEmpty(),
    body('oauth_version').equals('1.0'),
    body('resource_link_id').notEmpty(),
    body('resource_link_title').notEmpty(),
    body('roles').custom((value) => {
        if (![process.env.ROLE_TEACHER, process.env.ROLE_STUDENT, 'urn:lti:role:ims/lis/TeachingAssistant'].some((element) => element === value)) {
            throw new Error('Invalid value');
        }
        return true;
    }),
    body('tool_consumer_info_product_family_code').equals('canvas'),
    body('tool_consumer_info_version').notEmpty(),
    body('tool_consumer_instance_contact_email').notEmpty(),
    body('tool_consumer_instance_guid').notEmpty(),
    body('tool_consumer_instance_name').notEmpty(),
    body('user_id').notEmpty(),
    body('oauth_signature').notEmpty(),
], isValidInput, async (req, res) => {
    try {
        const consumer = await getConsumer(req.body);
        const sign = hmacsign(
            'POST',
            `https://quizpeers.uib.no/api/launch/assignment/${req.params.id}`,
            getAssignmentParams(req.body),
            consumer.secret,
        );
        if (sign === req.body.oauth_signature) {
            if (req.body.roles === process.env.ROLE_TEACHER) {
                await startAssignment(req.params.id, req.body);
            }
            try {
                await setUser(req);
                res.redirect(url.format({
                    pathname: `/assignment/${req.params.id}`,
                    query: { 'lang': req.body.launch_presentation_locale },
                }));
            } catch (err) {
                logError('Could not set user object', err);
                res.sendStatus(500);
            }
        } else res.status(403).json({ message: 'Invalid Oauth signature' });
    } catch (err) {
        logError('Could not validate the request', err);
        res.sendStatus(403);
    }
});

/**
 * Send resource return
 * Body: id
 */
router.post('/resource', isAuthenticated, isInstructor, [
    body('id').notEmpty(),
], isValidInput, (req, res) => {
    if (req.session.returnUrl && req.session.returnType) {
        res.status(200).json({ location: `${req.session.returnUrl}?return_type=${req.session.returnType}&url=${process.env.API_URL}/launch/assignment/${req.body.id}` });
        res.end();
    } else {
        req.session.destroy((err) => {
            if (err) {
                res.sendStatus(500);
            } else {
                res.clearCookie(process.env.SESSION_NAME);
                res.sendStatus(403);
            }
        });
    }
});

/**
 * Invalidate session
 */
router.post('/invalidate', isAuthenticated, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.sendStatus(500);
        } else {
            res.clearCookie(process.env.SESSION_NAME);
            res.sendStatus(200);
        }
    });
});

export default router;

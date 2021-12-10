import axios from 'axios';
import crypto from 'crypto';
import pkg from 'oauth-sign';
import cron from 'cron';
import Sequelize from 'sequelize';
import Nonce from '../models/Nonce.js';
import User from '../models/User.js';
import { logError } from './logger.js';
import Consumer from '../models/Consumer.js';

const { hmacsign } = pkg;

/**
 * Create LTI replace result request
 *
 * @param {float} score Total score
 * @param {string} returnId Return ID (lis_result_sourcedid)
 * @param {string} consumerKey Consumer key
 * @param {string} secret Consumer secret
 * @param {string} outcomeUrl Score passback URL (lis_outcome_service_url)
 */
const replaceResult = (score, returnId, consumerKey, secret, outcomeUrl) => {
  const xml = `<?xml version = "1.0" encoding = "UTF-8"?>
                        <imsx_POXEnvelopeRequest xmlns = "http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
                          <imsx_POXHeader>
                            <imsx_POXRequestHeaderInfo>
                              <imsx_version>V1.0</imsx_version>
                              <imsx_messageIdentifier>${crypto.randomBytes(16).toString('hex')}</imsx_messageIdentifier>
                            </imsx_POXRequestHeaderInfo>
                          </imsx_POXHeader>
                          <imsx_POXBody>
                            <replaceResultRequest>
                              <resultRecord>
                                <sourcedGUID>
                                  <sourcedId>${returnId}</sourcedId>
                                </sourcedGUID>
                                <result>
                                  <resultTotalScore>
                                    <language>en</language>
                                    <textString>${score}</textString>
                                  </resultTotalScore>
                                </result>
                              </resultRecord>
                            </replaceResultRequest>
                          </imsx_POXBody>
                        </imsx_POXEnvelopeRequest>`;
  const params = {
    oauth_body_hash: crypto.createHash('sha1').update(xml).digest('base64'),
    oauth_callback: 'about:blank',
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('base64'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_version: '1.0',
  };
  return [xml, 'OAuth realm="",'
    + `oauth_body_hash="${encodeURIComponent(params.oauth_body_hash)}",`
    + `oauth_callback="${encodeURIComponent(params.oauth_callback)}",`
    + `oauth_consumer_key="${encodeURIComponent(params.oauth_consumer_key)}",`
    + `oauth_nonce="${encodeURIComponent(params.oauth_nonce)}",`
    + `oauth_timestamp="${encodeURIComponent(params.oauth_timestamp)}",`
    + `oauth_signature="${encodeURIComponent(hmacsign('POST', outcomeUrl, params, secret))}",`
    + `oauth_signature_method="${encodeURIComponent(params.oauth_signature_method)}",`
    + `oauth_version="${encodeURIComponent(params.oauth_version)}"`];
};

/**
 * Publish score to LMS
 *
 * @param {Object} consumer Consumer object
 * @param {float} score Total score
 * @param {string} returnId Return ID (lis_result_sourcedid)
 * @param {string} outcomeUrl Score passback URL (lis_outcome_service_url)
 */
export const publishScore = async (consumer, score, returnId, outcomeUrl) => {
  const replaceResultRequest = replaceResult(
    score,
    returnId,
    consumer.key,
    consumer.secret,
    outcomeUrl,
  );
  await axios.post(
    outcomeUrl,
    replaceResultRequest[0],
    {
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': replaceResultRequest[1],
      },
      timeout: process.env.HTTP_TIMEOUT,
    },
  );
};

/**
 * Validate Oauth nonce and timestamp
 *
 * @param {string} nonce Oauth nonce
 * @param {string} timestamp Oauth timestamp
 */
const validateNonce = async (nonce, timestamp) => {
  try {
    const now = Math.floor(new Date().getTime() / 1000);
    const maxPast = now - parseInt(process.env.NONCE_LIMIT, 10);
    const maxFuture = now + parseInt(process.env.NONCE_LIMIT, 10);
    if (timestamp >= maxPast && timestamp <= maxFuture) {
      const [oauthNonce, created] = await Nonce.findOrCreate({
        where: { nonce },
        defaults: { nonce, timestamp },
      });
      if (created && oauthNonce.timestamp === timestamp) return true;
    }
  } catch (err) { }
  return false;
};

/**
 * Validate Oauth nonce/timestamp and return consumer object
 *
 * @param {Object} body Request body
 * @returns {Object} Consumer object
 */
export const getConsumer = async (body) => {
  const consumer = await Consumer.findOne({
    where: {
      id: body.tool_consumer_instance_guid,
      key: body.oauth_consumer_key,
      status: 'ACTIVE',
    },
  });
  if (consumer) {
    const validated = await validateNonce(body.oauth_nonce, body.oauth_timestamp);
    if (!validated) throw new Error('Invalid Oauth nonce or timestamp');
    return consumer;
  }
  throw new Error('Consumer is not registered');
};

/**
 * Remove expired nonces from database
 */
const removeExpiredNonces = async () => {
  try {
    await Nonce.destroy({
      where: {
        timestamp: {
          [Sequelize.Op.lt]:
            Math.floor(new Date().getTime() / 1000) - parseInt(process.env.NONCE_LIMIT, 10),
        },
      },
    });
  } catch (err) {
    logError('Could not delete expired nonce', err);
  }
};

/**
 * Schedule job for removing expired nonces
 */
export const nonceCleanup = async () => new cron.CronJob(`0 */${process.env.NONCE_CLEANUP_INTERVAL} * * * *`, () => {
  removeExpiredNonces();
}, null, true);

/**
 * Set user session and db object
 *
 * @param {Object} req HTTP request
 */
export const setUser = async (req) => {
  const user = {
    lmsId: req.body.user_id,
    consumerId: req.body.tool_consumer_instance_guid,
    name: req.body.lis_person_name_full,
  };
  const [newUser, created] = await User.findOrCreate({
    where: {
      lmsId: user.lmsId,
      consumerId: user.consumerId,
    },
    defaults: user,
  });
  req.session.userId = newUser.id;
  req.session.role = req.body.roles;
  req.session.consumerId = req.body.tool_consumer_instance_guid;
  req.session.courseId = req.body.context_id;
  req.session.returnId = req.body.lis_result_sourcedid;
  req.session.returnUrl = req.body.launch_presentation_return_url;
  req.session.returnType = req.body.ext_content_return_types;
  req.session.extension = newUser.extendDeadlineMins;
};

/**
 * Get resource launch params for Oauth
 *
 * @param {Object} body Request body
 */
export const getResourceParams = (body) => ({
  context_id: body.context_id,
  context_label: body.context_label,
  context_title: body.context_title,
  custom_canvas_enrollment_state: body.custom_canvas_enrollment_state,
  ext_content_intended_use: body.ext_content_intended_use,
  ext_content_return_types: body.ext_content_return_types,
  ext_content_return_url: body.ext_content_return_url,
  ext_roles: body.ext_roles,
  launch_presentation_document_target: body.launch_presentation_document_target,
  launch_presentation_height: body.launch_presentation_height,
  launch_presentation_locale: body.launch_presentation_locale,
  launch_presentation_return_url: body.launch_presentation_return_url,
  launch_presentation_width: body.launch_presentation_width,
  lis_person_name_family: body.lis_person_name_family,
  lis_person_name_given: body.lis_person_name_given,
  lis_person_name_full: body.lis_person_name_full,
  lti_message_type: body.lti_message_type,
  lti_version: body.lti_version,
  oauth_callback: body.oauth_callback,
  oauth_consumer_key: body.oauth_consumer_key,
  oauth_nonce: body.oauth_nonce,
  oauth_signature_method: body.oauth_signature_method,
  oauth_timestamp: body.oauth_timestamp,
  oauth_version: body.oauth_version,
  resource_link_id: body.resource_link_id,
  resource_link_title: body.resource_link_title,
  roles: body.roles,
  selection_directive: body.selection_directive,
  tool_consumer_info_product_family_code: body.tool_consumer_info_product_family_code,
  tool_consumer_info_version: body.tool_consumer_info_version,
  tool_consumer_instance_contact_email: body.tool_consumer_instance_contact_email,
  tool_consumer_instance_guid: body.tool_consumer_instance_guid,
  tool_consumer_instance_name: body.tool_consumer_instance_name,
  user_id: body.user_id,
});

/**
 * Get assignment launch params for Oauth
 *
 * @param {Object} body Request body
 */
export const getAssignmentParams = (body) => {
  if (body.roles === process.env.ROLE_TEACHER || body.roles === 'urn:lti:role:ims/lis/TeachingAssistant') {
    return {
      context_id: body.context_id,
      context_label: body.context_label,
      context_title: body.context_title,
      custom_canvas_assignment_points_possible: body.custom_canvas_assignment_points_possible,
      custom_canvas_assignment_title: body.custom_canvas_assignment_title,
      custom_canvas_enrollment_state: body.custom_canvas_enrollment_state,
      ext_ims_lis_basic_outcome_url: body.ext_ims_lis_basic_outcome_url,
      ext_lti_assignment_id: body.ext_lti_assignment_id,
      ext_outcome_data_values_accepted: body.ext_outcome_data_values_accepted,
      ext_outcome_result_total_score_accepted: body.ext_outcome_result_total_score_accepted,
      ext_outcome_submission_submitted_at_accepted:
        body.ext_outcome_submission_submitted_at_accepted,
      ext_outcomes_tool_placement_url: body.ext_outcomes_tool_placement_url,
      ext_roles: body.ext_roles,
      launch_presentation_document_target: body.launch_presentation_document_target,
      launch_presentation_locale: body.launch_presentation_locale,
      launch_presentation_return_url: body.launch_presentation_return_url,
      lis_outcome_service_url: body.lis_outcome_service_url,
      lis_person_name_family: body.lis_person_name_family,
      lis_person_name_given: body.lis_person_name_given,
      lis_person_name_full: body.lis_person_name_full,
      lti_message_type: body.lti_message_type,
      lti_version: body.lti_version,
      oauth_callback: body.oauth_callback,
      oauth_consumer_key: body.oauth_consumer_key,
      oauth_nonce: body.oauth_nonce,
      oauth_signature_method: body.oauth_signature_method,
      oauth_timestamp: body.oauth_timestamp,
      oauth_version: body.oauth_version,
      resource_link_id: body.resource_link_id,
      resource_link_title: body.resource_link_title,
      roles: body.roles,
      tool_consumer_info_product_family_code: body.tool_consumer_info_product_family_code,
      tool_consumer_info_version: body.tool_consumer_info_version,
      tool_consumer_instance_contact_email: body.tool_consumer_instance_contact_email,
      tool_consumer_instance_guid: body.tool_consumer_instance_guid,
      tool_consumer_instance_name: body.tool_consumer_instance_name,
      user_id: body.user_id,
    };
  }
  if (body.roles === process.env.ROLE_STUDENT && body.lis_result_sourcedid) {
    return {
      context_id: body.context_id,
      context_label: body.context_label,
      context_title: body.context_title,
      custom_canvas_assignment_points_possible: body.custom_canvas_assignment_points_possible,
      custom_canvas_assignment_title: body.custom_canvas_assignment_title,
      custom_canvas_enrollment_state: body.custom_canvas_enrollment_state,
      ext_ims_lis_basic_outcome_url: body.ext_ims_lis_basic_outcome_url,
      ext_lti_assignment_id: body.ext_lti_assignment_id,
      ext_outcome_data_values_accepted: body.ext_outcome_data_values_accepted,
      ext_outcome_result_total_score_accepted: body.ext_outcome_result_total_score_accepted,
      ext_outcome_submission_submitted_at_accepted:
        body.ext_outcome_submission_submitted_at_accepted,
      ext_outcomes_tool_placement_url: body.ext_outcomes_tool_placement_url,
      ext_roles: body.ext_roles,
      launch_presentation_document_target: body.launch_presentation_document_target,
      launch_presentation_locale: body.launch_presentation_locale,
      launch_presentation_return_url: body.launch_presentation_return_url,
      lis_outcome_service_url: body.lis_outcome_service_url,
      lis_person_name_family: body.lis_person_name_family,
      lis_person_name_given: body.lis_person_name_given,
      lis_person_name_full: body.lis_person_name_full,
      lis_result_sourcedid: body.lis_result_sourcedid,
      lti_message_type: body.lti_message_type,
      lti_version: body.lti_version,
      oauth_callback: body.oauth_callback,
      oauth_consumer_key: body.oauth_consumer_key,
      oauth_nonce: body.oauth_nonce,
      oauth_signature_method: body.oauth_signature_method,
      oauth_timestamp: body.oauth_timestamp,
      oauth_version: body.oauth_version,
      resource_link_id: body.resource_link_id,
      resource_link_title: body.resource_link_title,
      roles: body.roles,
      tool_consumer_info_product_family_code: body.tool_consumer_info_product_family_code,
      tool_consumer_info_version: body.tool_consumer_info_version,
      tool_consumer_instance_contact_email: body.tool_consumer_instance_contact_email,
      tool_consumer_instance_guid: body.tool_consumer_instance_guid,
      tool_consumer_instance_name: body.tool_consumer_instance_name,
      user_id: body.user_id,
    };
  }
  return undefined;
};

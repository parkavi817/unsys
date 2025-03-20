const axios = require('axios');
const dotenv = require('dotenv');
const moment = require('moment-timezone');
const { axiosRetry } = require('./helper');

dotenv.config();

/**
 * Schedule an Instagram post
 * @param {string} businessId - Instagram Business Account ID
 * @param {string} accessToken - Instagram Access Token
 * @param {string} imageUrl - URL of the image to be posted
 * @param {string} caption - Post caption
 * @param {string} scheduledTime - Scheduled post time in ISO format
 * @param {string} timezone - Timezone identifier (default is 'UTC')
 * @returns {Object} - Response from Instagram API
 */
async function scheduleInstagramPost(businessId, accessToken, imageUrl, caption, scheduledTime, timezone = 'UTC') {
    try {
        if (!businessId || !accessToken || !imageUrl) {
            throw new Error('Missing required parameters for Instagram post');
        }

        console.log('📸 Attempting to schedule Instagram post for business ID:', businessId);

        // Validate scheduledTime using ISO 8601 standard
        if (!moment(scheduledTime, moment.ISO_8601, true).isValid()) {
            throw new Error('Invalid scheduled time format; please provide an ISO8601-compatible string.');
        }

        // Convert scheduled time to Unix timestamp in seconds
        const scheduledTimestamp = moment.tz(scheduledTime, timezone).unix();

        // Step 1: Upload Image
        const containerResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${businessId}/media`,
            {
                image_url: imageUrl,
                caption,
                access_token: accessToken,
            }
        );

        if (!containerResponse.data?.id) {
            throw new Error('Failed to create media container');
        }

        const creationId = containerResponse.data.id;

        // Step 2: Publish the post (schedule if needed)
        const publishResponse = await axios.post(
            `https://graph.facebook.com/v18.0/${businessId}/media_publish`,
            {
                creation_id: creationId,
                access_token: accessToken,
                scheduled_publish_time: scheduledTimestamp
            }
        );

        return publishResponse.data;
    } catch (error) {
        console.error('Error scheduling Instagram post:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Fetch scheduled posts from Instagram
 * @param {string} businessId - Instagram Business Account ID
 * @param {string} accessToken - Instagram Access Token
 * @returns {Array} - List of scheduled posts
 */
async function getScheduledInstagramPosts(businessId, accessToken) {
    try {
        if (!businessId || !accessToken) {
            throw new Error('Missing required parameters for fetching Instagram posts');
        }

        console.log('📋 Fetching scheduled Instagram posts for business ID:', businessId);

        const response = await axios.get(
            `https://graph.facebook.com/v18.0/${businessId}/media`,
            { 
                params: { 
                    access_token: accessToken, 
                    fields: 'id,caption,media_url,timestamp' 
                } 
            }
        );

        if (!response.data?.data) {
            console.warn('No scheduled posts found or empty response');
            return [];
        }

        console.log(`✅ Found ${response.data.data.length} scheduled posts`);
        return response.data.data;
    } catch (error) {
        console.error('❌ Error fetching scheduled Instagram posts:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = { scheduleInstagramPost, getScheduledInstagramPosts };

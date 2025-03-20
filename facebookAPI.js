const axios = require("axios");
const moment = require("moment-timezone");
const dotenv = require("dotenv");
const { axiosRetry } = require("./helper");  // Ensure you have a retry helper

dotenv.config();

/**
 * Schedule a Facebook post
 *
 * @param {string} pageId - Facebook Page ID
 * @param {string} accessToken - Facebook Page Access Token
 * @param {string} message - Post content
 * @param {string} scheduledTime - Scheduled post time in ISO format
 * @param {string} timezone - Timezone (default: 'UTC')
 * @returns {Promise<Object>} - Response from Facebook API
 */
async function scheduleFacebookPost(pageId, accessToken, message, scheduledTime, timezone = "UTC") {
    try {
        if (!moment(scheduledTime, moment.ISO_8601, true).isValid()) {
            throw new Error("❌ Invalid scheduled time format. Please use ISO8601.");
        }

        // Convert scheduled time to Facebook-compatible timestamp
        const scheduledTimestamp = moment.tz(scheduledTime, timezone).unix();
        
        const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;

        const response = await axiosRetry({
            method: "post",
            url: url,
            data: {
                message: message,
                published: false, // Schedule the post instead of immediate publishing
                scheduled_publish_time: scheduledTimestamp,
                access_token: accessToken,
            }
        });

        console.log("✅ Facebook Post Scheduled:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error Scheduling Facebook Post:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Fetch scheduled posts from Facebook
 *
 * @param {string} pageId - Facebook Page ID
 * @param {string} accessToken - Facebook Page Access Token
 * @returns {Promise<Array>} - List of scheduled posts
 */
async function getScheduledFacebookPosts(pageId, accessToken) {
    try {
        const url = `https://graph.facebook.com/v18.0/${pageId}/scheduled_posts`;

        const response = await axiosRetry({
            method: "get",
            url: url,
            params: { access_token: accessToken },
        });

        console.log("✅ Scheduled Facebook Posts Retrieved:", response.data);
        return response.data.data || [];
    } catch (error) {
        console.error("❌ Error Fetching Scheduled Facebook Posts:", error.response?.data || error.message);
        throw error;
    }
}

module.exports = { scheduleFacebookPost, getScheduledFacebookPosts };

const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { google } = require("googleapis");
require("dotenv").config();

const credentialsPath = path.join(__dirname, "../GOOGLE_CREDENTIALS.json");

if (!fs.existsSync(credentialsPath)) {
    console.error("❌ GOOGLE_CREDENTIALS.json not found.");
    process.exit(1);
}

let credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
const oauthCredentials = credentials.installed || credentials.web;

const oauth2Client = new google.auth.OAuth2(
    oauthCredentials.client_id,
    oauthCredentials.client_secret,
    oauthCredentials.redirect_uris[0]
);

const tokensPath = path.join(__dirname, "../tokens.json");

if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
    oauth2Client.setCredentials(tokens);
}

/**
 * Schedules a YouTube video upload with timezone support.
 *
 * @param {string} videoPath - Path to the video file.
 * @param {string} title - Title of the video.
 * @param {string} description - Description of the video.
 * @param {string} scheduledTime - Scheduled time (ISO8601 format).
 * @param {string} timezone - Timezone (default: 'UTC').
 * @returns {Promise<Object>} - The API response.
 */
async function scheduleYouTubeVideo(videoPath, title, description, scheduledTime, timezone = "UTC") {
    try {
        if (!fs.existsSync(videoPath)) {
            throw new Error("❌ Video file not found.");
        }

        if (!moment(scheduledTime, moment.ISO_8601, true).isValid()) {
            throw new Error("❌ Invalid scheduled time format; use ISO8601.");
        }

        // Convert scheduled time to RFC 3339 format
        const scheduledPublishTime = moment.tz(scheduledTime, timezone).toISOString();

        const youtube = google.youtube({ version: "v3", auth: oauth2Client });
        const videoFileSize = fs.statSync(videoPath).size;

        const response = await youtube.videos.insert(
            {
                part: "snippet,status",
                requestBody: {
                    snippet: {
                        title: title,
                        description: description,
                        categoryId: "22",
                    },
                    status: {
                        privacyStatus: "private",
                        publishAt: scheduledPublishTime,
                    },
                },
                media: {
                    body: fs.createReadStream(videoPath),
                },
            },
            {
                onUploadProgress: (evt) => {
                    const progress = (evt.bytesRead / videoFileSize) * 100;
                    console.log(`📤 ${Math.round(progress)}% uploaded`);
                },
            }
        );

        console.log("✅ Video Scheduled Successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Failed to schedule video:", error.message);
        throw error;
    }
}

/**
 * Fetches scheduled YouTube videos.
 * @returns {Promise<Array>} - List of scheduled videos.
 */
async function getScheduledYouTubeVideos() {
    try {
        const youtube = google.youtube({ version: "v3", auth: oauth2Client });

        const response = await youtube.search.list({
            part: "snippet",
            forMine: true,
            type: "video",
            order: "date",
            maxResults: 10,
            eventType: "upcoming",
        });

        console.log("📅 Fetched scheduled videos:", response.data.items);
        return response.data.items;
    } catch (error) {
        console.error("❌ Failed to fetch scheduled videos:", error.message);
        throw new Error("Failed to fetch scheduled YouTube videos");
    }
}

/**
 * Uploads a YouTube video immediately.
 *
 * @param {string} videoTitle - Title of the video.
 * @param {string} videoDescription - Description of the video.
 * @param {string} videoFilePath - Path to the video file.
 * @returns {Promise<Object>} - The API response.
 */
async function postYouTubeVideo(videoTitle, videoDescription, videoFilePath) {
    try {
        if (!fs.existsSync(videoFilePath)) {
            throw new Error("❌ Video file not found.");
        }

        const youtube = google.youtube({ version: "v3", auth: oauth2Client });
        const videoFileSize = fs.statSync(videoFilePath).size;

        const response = await youtube.videos.insert(
            {
                part: "snippet,status",
                requestBody: {
                    snippet: {
                        title: videoTitle,
                        description: videoDescription,
                    },
                    status: {
                        privacyStatus: "public",
                    },
                },
                media: {
                    body: fs.createReadStream(videoFilePath),
                },
            },
            {
                onUploadProgress: (evt) => {
                    const progress = (evt.bytesRead / videoFileSize) * 100;
                    console.log(`📤 ${Math.round(progress)}% uploaded`);
                },
            }
        );

        console.log("✅ Video Uploaded Successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error uploading video:", error.message);
        throw new Error("YouTube Video Upload Failed");
    }
}

module.exports = {
    scheduleYouTubeVideo,
    getScheduledYouTubeVideos,
    postYouTubeVideo,
};

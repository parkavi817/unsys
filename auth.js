const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');


// Initialize environment variables
dotenv.config();




const credentialsPath = path.join(__dirname, '../GOOGLE_CREDENTIALS.json');

if (!fs.existsSync(credentialsPath)) {
    console.error('Error: Google credentials file is missing.');
    process.exit(1);
}

// Initialize OAuth2 client
function initializeOAuthClient() {
    try {
        console.log('🔑 Loading Google credentials from:', credentialsPath);
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        
        if (!credentials.web) {
            throw new Error('Invalid credentials format - missing web property');
        }
        
        const { client_id, client_secret, redirect_uris } = credentials.web;
        
        if (!client_id || !client_secret || !redirect_uris) {
            throw new Error('Missing required credentials properties');
        }
        
        console.log('✅ Successfully loaded Google credentials');
        oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        return oauth2Client;
    } catch (error) {
        console.error('❌ Error initializing OAuth client:', error);
        throw error;
    }
}


// Initialize client immediately
let oauth2Client;
try {
    console.log('🚀 Initializing OAuth2 client...');
    oauth2Client = initializeOAuthClient();
    
    if (!oauth2Client) {
        throw new Error('Failed to initialize OAuth2 client - returned null/undefined');
    }
    
    console.log('✅ OAuth2 client successfully initialized');
} catch (error) {
    console.error('❌ Critical error initializing OAuth2 client:', error);
    console.error('Please verify your GOOGLE_CREDENTIALS.json file and try again');
    process.exit(1);
}

const tokensPath = path.join(__dirname, '../tokens.json');

if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    // Verify token expiration and refresh token presence
    if (tokens.expiry_date && Date.now() > tokens.expiry_date) {
        if (!tokens.refresh_token) {
            console.error('No refresh token available. Please re-authenticate.');
            return;
        }
        console.log('Token expired, refreshing...');
        oauth2Client.refreshAccessToken((err, newTokens) => {
            if (err) {
                console.error('Error refreshing token:', err);
                // If refresh fails, prompt for re-authentication
                console.log('Please re-authenticate by visiting /auth/google');
                return;
            }
            oauth2Client.setCredentials(newTokens);
            fs.writeFileSync(tokensPath, JSON.stringify(newTokens, null, 2));
        });
    } else {
        oauth2Client.setCredentials(tokens);
    }
}



oauth2Client.on('tokens', (tokens) => {
    // Always store tokens, but ensure refresh token is preserved
    const currentTokens = fs.existsSync(tokensPath) ? 
        JSON.parse(fs.readFileSync(tokensPath, 'utf8')) : {};
    const updatedTokens = {
        ...currentTokens,
        ...tokens,
        expiry_date: Date.now() + (tokens.expires_in * 1000),
        // Preserve existing refresh token if new one isn't provided
        refresh_token: tokens.refresh_token || currentTokens.refresh_token
    };
    fs.writeFileSync(tokensPath, JSON.stringify(updatedTokens, null, 2));
});


// Add error handling for token refresh
oauth2Client.on('error', (err) => {
    console.error('OAuth2 Error:', err);
    if (err.code === 401) {
        console.log('Attempting to refresh token...');
        oauth2Client.refreshAccessToken((err, newTokens) => {
            if (err) {
                console.error('Failed to refresh token:', err);
                return;
            }
            oauth2Client.setCredentials(newTokens);
            fs.writeFileSync(tokensPath, JSON.stringify(newTokens, null, 2));
        });
    }
});


/**
 * Handles Google OAuth authentication.
 */
function authenticateGoogleOAuth(req, res) {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent select_account',

        scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.force-ssl',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
        ],
    });
    res.redirect(authUrl);
}

// Export initialized client and functions
async function getAccessToken() {
    try {
        const response = await axios.post("https://oauth2.googleapis.com/token", null, {
            params: {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                refresh_token: process.env.REFRESH_TOKEN,
                grant_type: "refresh_token",
            },
        });

        return response.data.access_token;
    } catch (error) {
        console.error("Error getting access token:", error.response.data);
        return null;
    }
}

async function getUserEmail() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        console.error("No access token available.");
        return;
    }

    try {
        const response = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        console.log("User Email:", response.data.email);
    } catch (error) {
        console.error("Error fetching email:", error.response.data);
    }
}

module.exports = {

    get oauth2Client() {
        if (!oauth2Client) {
            throw new Error('OAuth2 client not initialized');
        }
        return oauth2Client;
    },
    authenticateGoogleOAuth,
    getAccessToken,
    getUserEmail

};

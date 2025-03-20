const express = require('express');
const path = require('path');
const nodemailer = require("nodemailer");
const axios = require('axios');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const fs = require('fs');
const moment = require('moment-timezone');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// OAuth2 Setup
const OAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
OAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// Function to send email using OAuth2
async function sendEmail(toEmail, subject, message) {
  try {
    // Validate required environment variables
    const requiredVars = ['EMAIL_SENDER', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
      }
    }

    // Generate Access Token with error handling
    let accessToken;
    try {
      accessToken = await OAuth2Client.getAccessToken();
      if (!accessToken || !accessToken.token) {
        throw new Error('Failed to generate access token');
      }
    } catch (tokenError) {
      console.error('❌ Token generation error:', tokenError);
      throw new Error('Authentication failed. Please check your OAuth2 credentials.');
    }

    // Create Transporter with additional options
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_SENDER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
      // Add connection timeout and retry options
      pool: true,
      maxConnections: 1,
      maxMessages: 5,
      rateDelta: 1000,
      rateLimit: 5
    });

    // Email Options
    const mailOptions = {
      from: `Google Forms Reminder <${process.env.EMAIL_SENDER}>`,
      to: toEmail,
      subject: subject,
      text: message,
    };

    // Send Email with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`📩 Email sent to ${toEmail}`);
        return result;
      } catch (sendError) {
        retries--;
        if (retries === 0) {
          console.error("❌ Failed to send email after 3 attempts:", sendError);
          throw new Error(`Failed to send email: ${sendError.message}`);
        }
        console.warn(`⚠️ Email send failed, retrying... (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  } catch (error) {
    console.error("❌ Error in sendEmail function:", error);
    throw error; // Re-throw to allow calling function to handle
  }
}

// Signup API Endpoint
app.post('/api/signup', (req, res) => {
  const { email } = req.body;
  sendEmail(email, 'Signup Successful', 'You have successfully signed in!')
    .then(() => {
      res.status(200).json({ message: 'Signup successful' });
    })
    .catch((error) => {
      res.status(500).json({ message: 'Failed to send confirmation email', error: error.message });
    });
});

// Google Form Reminder API Endpoint
app.post('/api/send-google-form-reminder', (req, res) => {
  const { email } = req.body;
  sendEmail(email, 'Google Form Reminder', 'This is a reminder to submit your Google Form.')
    .then(() => {
      res.status(200).json({ message: 'Reminder sent' });
    })
    .catch((error) => {
      res.status(500).json({ message: 'Failed to send reminder', error: error.message });
    });
});

// Load Google OAuth Credentials
const credentialsPath = path.join(__dirname, 'GOOGLE_CREDENTIALS.json');
const tokensPath = path.join(__dirname, 'tokens.json');

let oauth2Client;

try {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Google credentials file not found at: ${credentialsPath}`);
  }
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const { client_id, client_secret, redirect_uris } = credentials.web;
  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Load tokens if available
  if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath));
    oauth2Client.setCredentials(tokens);
  }

  // Refresh token if expired
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      fs.writeFileSync(tokensPath, JSON.stringify(tokens));
    }
  });

  // Middleware
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json());

  let reminders = [];

  // Google OAuth Authentication Routes
  app.get('/auth/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/youtube.upload'
      ],
    });
    res.redirect(authUrl);
  });

  // OAuth Callback - Retrieve Access Token
  app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    try {
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens) {
        throw new Error('No tokens received from Google');
      }
      oauth2Client.setCredentials(tokens);
      fs.writeFileSync(tokensPath, JSON.stringify(tokens));
      res.json({ 
        success: true,
        message: 'Authentication successful! You can now use Google APIs.'
      });
    } catch (error) {
      console.error('Error retrieving access token:', error);
      res.status(500).json({ 
        error: 'Authentication failed',
        details: error.message 
      });
    }
  });

  // Fetch Google Form submissions
  app.get('/api/fetch-google-forms', async (req, res) => {
    try {
      if (!oauth2Client.credentials) {
        throw new Error('Not authenticated with Google');
      }
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      if (!process.env.GOOGLE_SPREADSHEET_ID) {
        throw new Error('Google Spreadsheet ID not configured');
      }

      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      });
      
      const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
      console.log('Spreadsheet Metadata:', {
        title: spreadsheet.data.properties?.title,
        sheetCount: spreadsheet.data.sheets.length,
        sheetNames: sheetNames
      });

      if (!sheetNames.includes('Sheet1')) {
        throw new Error(`Sheet 'Sheet1' not found. Available sheets: ${sheetNames.join(', ')}`);
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: 'Sheet1!A1:E',
      });

      console.log('Sheets API Response:', {
        range: response.data.range,
        majorDimension: response.data.majorDimension,
        values: response.data.values ? response.data.values.length : 0
      });

      if (!response.data.values) {
        console.warn('No data found in Sheet1. Please ensure the sheet contains data in columns A-E');
      }

      if (response.data.values) {
        const submissions = response.data.values.slice(1).map((row, index) => ({
          id: Date.now() + index,
          title: row[0] || 'Untitled',
          description: row[1] || 'No Description',
          date: row[2] || new Date().toISOString().split('T')[0],
          time: row[3] || '00:00',
          platform: 'Google Forms',
          content: row[4] || ''
        }));
        reminders = submissions;
        res.json(submissions);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error('Error fetching Google Form submissions:', error.response?.data || error.message);
      res.status(500).json({
        error: 'Error fetching Google Form submissions',
        details: error.message
      });
    }
  });

  // Helper function to schedule YouTube posts
  async function scheduleYouTubePost(title, description, date, time) {
    const scheduled_time = `${date}T${time}`;
    const utcTime = moment.tz(scheduled_time, "Asia/Kolkata").utc().format();
    console.log("Converted UTC Time:", utcTime);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
      const response = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
          snippet: { title, description },
          status: { privacyStatus: 'private', publishAt: utcTime }
        },
      });
      return response.data;
    } catch (error) {
      throw new Error('Error scheduling YouTube post: ' + error.message);
    }
  }

  // Helper function to schedule Facebook posts
  async function scheduleFacebookPost(content, date, time) {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    if (!pageId) {
      throw new Error('Facebook Page ID not configured');
    }

    const scheduledTime = new Date(`${date}T${time}`);
    if (isNaN(scheduledTime.getTime())) {
      throw new Error('Invalid date/time format');
    }

    const dateTime = Math.floor(scheduledTime.getTime() / 1000);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        message: content,
        published: false,
        scheduled_publish_time: dateTime
      },
      {
        params: { access_token: process.env.FACEBOOK_ACCESS_TOKEN },
        timeout: 10000
      }
    );

    return response.data;
  }

  // Helper function to schedule Instagram posts
  async function scheduleInstagramPost(content, date, time) {
    const instagramBusinessId = process.env.INSTAGRAM_BUSINESS_ID;
    if (!instagramBusinessId) {
      throw new Error('Instagram Business ID not configured');
    }

    const scheduledTime = new Date(`${date}T${time}`);
    if (isNaN(scheduledTime.getTime())) {
      throw new Error('Invalid date/time format');
    }

    const dateTime = Math.floor(scheduledTime.getTime() / 1000);

    const mediaResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/media`,
      {
        image_url: content,
        caption: content
      },
      {
        params: { access_token: process.env.INSTAGRAM_ACCESS_TOKEN },
        timeout: 10000
      }
    );

    const creationId = mediaResponse.data.id;

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/media_publish`,
      {
        creation_id: creationId
      },
      {
        params: { access_token: process.env.INSTAGRAM_ACCESS_TOKEN },
        timeout: 10000
      }
    );

    return response.data;
  }

  // Schedule YouTube Post
  app.post('/api/schedule-youtube', async (req, res) => {
    const { title, description, date, time } = req.body;
    if (!title || !description || !date || !time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      const result = await scheduleYouTubePost(title, description, date, time);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule Facebook Post
  app.post('/api/schedule-facebook', async (req, res) => {
    const { content, date, time } = req.body;
    if (!content || !date || !time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      const result = await scheduleFacebookPost(content, date, time);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Schedule Instagram Post
  app.post('/api/schedule-instagram', async (req, res) => {
    const { content, date, time } = req.body;
    if (!content || !date || !time) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      const result = await scheduleInstagramPost(content, date, time);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reminder APIs
  app.get('/api/reminders', (req, res) => res.json(reminders));
  app.get('/api/youtube/scheduled', async (req, res) => {
    try {
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const response = await youtube.search.list({
        part: 'snippet',
        forMine: true,
        type: 'video',
        eventType: 'upcoming'
      });
      res.json(response.data.items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/reminders', (req, res) => {
    const { title, description, date, time, platform, content } = req.body;
    const newReminder = { id: Date.now(), title, description, date, time, platform, content };
    reminders.push(newReminder);
    res.json(newReminder);
  });

  app.delete('/api/reminders/:id', (req, res) => {
    const { id } = req.params;
    reminders = reminders.filter(r => r.id !== parseInt(id));
    res.status(204).send();
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error('Failed to initialize server:', error);
  process.exit(1);
}

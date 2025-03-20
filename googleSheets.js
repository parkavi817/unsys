const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const { oauth2Client } = require('./auth');
const dotenv = require('dotenv');

dotenv.config();
const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

async function getGoogleFormsData(spreadsheetId, range) {
    try {
        // Validate inputs
        if (!spreadsheetId || !range) {
            throw new Error('Missing required parameters: spreadsheetId and range');
        }

        // Make API call
        const response = await sheets.spreadsheets.values.get({ 
            spreadsheetId, 
            range 
        });

        // Validate response
        if (!response.data || !response.data.values) {
            throw new Error('Invalid response format from Google Sheets API');
        }

        // Process data
        return response.data.values.slice(1).map(row => ({
            timestamp: row[0] || '',
            name: row[1] || '',
            email: row[2] || '',
            response: row[3] || '',
        }));
    } catch (error) {
        console.error('Error fetching Google Forms data:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });
        throw new Error('Failed to fetch Google Forms submissions');
    }
}


async function sendGoogleFormReminders() {
    try {
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        const data = await getGoogleFormsData(spreadsheetId, 'A:D');

        const submittedEmails = data.map(entry => entry.email);
        const allUsers = process.env.USER_EMAILS.split(',');

        const missingUsers = allUsers.filter(email => !submittedEmails.includes(email));

        if (missingUsers.length > 0) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_SENDER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            for (const email of missingUsers) {
                await transporter.sendMail({
                    from: `"Reminder Bot" <${process.env.EMAIL_SENDER}>`,
                    to: email,
                    subject: 'Reminder: Fill Out Google Form',
                    text: `Hi, \n\nYou haven't submitted the form yet. \n\nForm Link: ${process.env.GOOGLE_FORM_LINK}\n\nThanks!`
                });

                console.log(`✅ Reminder sent to: ${email}`);
            }
        }
    } catch (error) {
        console.error('❌ Failed to send reminders:', error);
    }
}

module.exports = { getGoogleFormsData, sendGoogleFormReminders };

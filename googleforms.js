require("dotenv").config();
const axios = require("axios");
const { axiosRetry } = require("./helper");

// Fetch Emails from Google Sheets
async function fetchEmails() {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) {
      throw new Error("Google Sheet URL not configured in environment variables.");
    }

    // Make the GET request with our retry helper
    const response = await axiosRetry({
      method: "get",
      url: sheetUrl,
      timeout: 5000  // set a timeout to avoid hanging requests
    });
    
    // Example: expecting the response to contain an "emails" field that is an array
    if (!response.data || !Array.isArray(response.data.emails)) {
      throw new Error("Unexpected response format; 'emails' field should be an array.");
    }
    
    return response.data.emails;
  } catch (error) {
    console.error("Error fetching emails from Google Sheets:", error.message);
    throw error;
  }
}

module.exports = { fetchEmails };

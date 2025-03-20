const axios = require('axios');

/**
 * Makes an axios request with a retry capability.
 *
 * @param {Object} axiosConfig - The axios configuration object.
 * @param {number} retries - Number of retry attempts.
 * @param {number} delay - Delay between retries in milliseconds.
 * @returns {Promise} - Resolves with the axios response.
 */
async function axiosRetry(axiosConfig, retries = 3, delay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios(axiosConfig);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { axiosRetry };
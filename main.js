document.addEventListener('DOMContentLoaded', async () => {
    const signupForm = document.getElementById('signupForm');
    const reminderForm = document.getElementById('reminderForm');
    const platformSelect = document.getElementById('platform');
    const uploadChoice = document.getElementById('uploadChoice');
    const shareChoice = document.getElementById('shareChoice');
    const uploadSection = document.getElementById('uploadSection');
    const youtubeUploadSection = document.getElementById('youtubeUploadSection');
    const socialMediaUploadSection = document.getElementById('socialMediaUploadSection');
    const textPostSection = document.getElementById('textPostSection');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const youtubeUploadInput = document.getElementById('youtubeUploadInput');
    const socialMediaUploadInput = document.getElementById('socialMediaUpload');
    const signUpButton = document.getElementById('signUpButton');
    const allowedVideoTypes = ['video/mp4', 'video/x-m4v', 'video/*']; // example for video
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/*']; // example for image


    // Show error message function
    function showError(message) {
        if (!errorMessage) return;
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => { 
            if (errorMessage) {
                errorMessage.style.display = 'none';
            }
        }, 5000);
        console.error(message);
    }

    // Show success message function
    function showSuccess(message) {
        if (!successMessage) return;
        successMessage.textContent = message;
        successMessage.style.display = 'block';
    
        // Disable form fields after success
        const form = successMessage.closest('form');
        if (form) {
            form.querySelectorAll('input').forEach(input => input.disabled = true);
        }
    
        setTimeout(() => {
            if (successMessage) {
                successMessage.style.display = 'none';
            }
        }, 5000);
        console.log(message);
    }
    
 // Signup form submission
 if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;

        if (!email) {
            showError('Please enter an email address');
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                throw new Error('Failed to send signup email');
            }

            showSuccess('Signup successful, confirmation email sent!');
            signupForm.reset();
        } catch (error) {
            showError(error.message);
        }
    });
}
// Assuming you have the scheduled date and time inputs (date and time)
const scheduledDateTime = new Date(`${date}T${time}:00`);

// Check if the scheduled time is in the future
if (scheduledDateTime <= new Date()) {
    showError('Scheduled time must be in the future.');
    return;
}

// Google Form Reminder form submission
if (reminderForm) {
    reminderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reminderEmail').value;

        if (!email) {
            showError('Please enter an email address');
            return;
        }

        // Now proceed with sending the reminder if the scheduled time is valid
        try {
            const response = await fetch('/api/send-google-form-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                throw new Error('Failed to send reminder email');
            }

            showSuccess('Google Form reminder sent!');
            reminderForm.reset(); // Clear the form after submission

        } catch (error) {
            showError(error.message);
        }
    });
}


// Other functions like YouTube video upload, social media upload, etc.
// Add a loading state before fetching posts
document.getElementById('scheduledPosts').innerHTML = '<p>Loading scheduled posts...</p>';

try {
    // Call the function to fetch and display scheduled posts
    await fetchScheduledPosts();
} catch (error) {
    showError('Failed to fetch scheduled posts: ' + error.message);
}

async function fetchScheduledPosts() {
    try {
        const response = await fetch('/api/youtube/scheduled');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received from server');
        }

        displayScheduledPosts(data);
    } catch (error) {
        // Handle any errors here (network issues, invalid response, etc.)
        showError(`Failed to fetch scheduled posts: ${error.message}`);
    }
}

    function displayScheduledPosts(posts) {
        const container = document.getElementById('scheduledPosts');
        if (!container) return;

        container.innerHTML = posts.map(post => `
            <div class="scheduled-post">
                <h3>${post.snippet.title}</h3>
                <p>Scheduled for: ${new Date(post.snippet.publishAt).toLocaleString()}</p>
            </div>
        `).join('');
    }

    // Validate `youtubeUploadInput` existence before usage
    if (youtubeUploadInput) {
        youtubeUploadInput.addEventListener('change', async (e) => {
            if (!platformSelect.value) {
                showError('Please select a platform first');
                return;
            }

            const file = e.target.files[0];
            if (!file) return;
            if (!allowedVideoTypes.includes(file.type)) {
                showError('Please upload a valid video file (MP4, M4V, etc.).');
                return;
            }

            try {
                setLoading(youtubeUploadInput, true);
                const formData = new FormData();
                formData.append('video', file);

                const response = await fetch('/api/upload-video', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to upload video');
                }

                const data = await response.json();
                showSuccess('Video uploaded successfully!');
                const youtubeForm = youtubeUploadInput.closest('form');
            if (youtubeForm) {
                youtubeForm.querySelectorAll('input').forEach(input => input.disabled = true);
            }
                document.getElementById('videoFilename').value = data.data.filename;
            } catch (error) {
                showError(error.message);
            } finally {
                setLoading(youtubeUploadInput, false);
            }
        });
    }

    // Handle Facebook/Instagram image upload
    if (socialMediaUploadInput) {
        socialMediaUploadInput.addEventListener('change', async (e) => {
            if (!platformSelect.value) {
                showError('Please select a platform first');
                return;
            }

            const file = e.target.files[0];
            if (!file) return;
            if (!allowedImageTypes.includes(file.type)) {
                showError('Please upload a valid image file (JPEG, PNG, etc.).');
                return;
            }

            try {
                setLoading(socialMediaUploadInput, true);
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch('/api/upload-image', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to upload image');
                }

                const data = await response.json();
                showSuccess('Image uploaded successfully!');
                const socialMediaForm = socialMediaUploadInput.closest('form');
            if (socialMediaForm) {
                socialMediaForm.querySelectorAll('input').forEach(input => input.disabled = true);
            }
                document.getElementById('imageFilename').value = data.data.filename;
            } catch (error) {
                showError(error.message);
            } finally {
                setLoading(socialMediaUploadInput, false);
            }
        });
    }

    // Handle form submission for scheduling posts
    if (reminderForm) {
        reminderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const platform = platformSelect?.value;
            const date = document.getElementById('date')?.value;
            const time = document.getElementById('time')?.value;

            if (!platform || !date || !time) {
                showError('Please fill in all required fields');
                return;
            }

            if (errorMessage) {
                errorMessage.textContent = '';
            }

            try {
                let response;
                const scheduledTime = convertToIST(date, time);

                switch (platform) {
                    case 'YouTube': {
                        const title = document.getElementById('title').value;
                        const description = document.getElementById('description').value;
                        const videoFilename = document.getElementById('videoFilename').value;

                        if (!videoFilename) {
                            throw new Error('Please upload a video first');
                        }

                        response = await fetch('/api/schedule-youtube', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                title,
                                description,
                                video_filename: videoFilename,
                                scheduled_time: scheduledTime
                            })
                        });
                        break;
                    }
                    case 'Facebook': {
                        const content = document.getElementById('content').value;
                        response = await fetch('/api/schedule-facebook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content, scheduled_time: scheduledTime })
                        });
                        break;
                    }
                    case 'Instagram': {
                        const content = document.getElementById('content').value;
                        response = await fetch('/api/schedule-instagram', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content, scheduled_time: scheduledTime })
                        });
                        break;
                    }
                    default: {
                        showError('Invalid platform selected');
                        return;
                    }
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to schedule post');
                }

                showSuccess('Post scheduled successfully!');
            } catch (error) {
                showError(error.message);
            }
        });
    }

    // Sign-Up Button to send confirmation email
    if (signUpButton) {
        signUpButton.addEventListener('click', async () => {
            const email = document.getElementById('email').value;

            if (!email) {
                showError('Please enter a valid email');
                return;
            }

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to sign up');
                }

                showSuccess('You have successfully signed up!');
            } catch (error) {
                showError(error.message);
            }
        });
    }
});

// Function to convert date and time to IST
function convertToIST(date, time) {
    const dateTime = new Date(`${date}T${time}:00`);
    // Convert to IST (Indian Standard Time)
    return dateTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
}

// Utility function to show/hide loading state
function setLoading(element, isLoading) {
    if (!element) return;
    if (isLoading) {
        element.disabled = true;
        element.style.opacity = '0.5';
    } else {
        element.disabled = false;
        element.style.opacity = '1';
    }
}

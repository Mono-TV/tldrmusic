/**
 * TLDR Music - Onboarding Wizard
 * 3-step preference collection for new users
 */

// Onboarding configuration
const ONBOARDING_CONFIG = {
    API_BASE: 'https://tldr-music-401132033262.asia-south1.run.app'
};

// Onboarding data
const ONBOARDING_DATA = {
    languages: [
        { code: 'hi', name: 'Hindi', emoji: '🇮🇳' },
        { code: 'en', name: 'English', emoji: '🇬🇧' },
        { code: 'pa', name: 'Punjabi', emoji: '🎵' },
        { code: 'ta', name: 'Tamil', emoji: '🇮🇳' },
        { code: 'te', name: 'Telugu', emoji: '🇮🇳' },
        { code: 'ml', name: 'Malayalam', emoji: '🇮🇳' },
        { code: 'kn', name: 'Kannada', emoji: '🇮🇳' },
        { code: 'mr', name: 'Marathi', emoji: '🇮🇳' },
        { code: 'bn', name: 'Bengali', emoji: '🇮🇳' },
        { code: 'gu', name: 'Gujarati', emoji: '🇮🇳' },
    ],
    genres: [
        { id: 'Bollywood', name: 'Bollywood', emoji: '🎬' },
        { id: 'Hip-Hop/Rap', name: 'Hip-Hop/Rap', emoji: '🎤' },
        { id: 'Pop', name: 'Pop', emoji: '🎵' },
        { id: 'Rock', name: 'Rock', emoji: '🎸' },
        { id: 'Classical', name: 'Classical', emoji: '🎻' },
        { id: 'EDM', name: 'EDM', emoji: '🎧' },
        { id: 'Jazz', name: 'Jazz', emoji: '🎺' },
        { id: 'Folk', name: 'Folk', emoji: '🪕' },
        { id: 'Devotional', name: 'Devotional', emoji: '🙏' },
        { id: 'Indie', name: 'Indie', emoji: '🎹' },
    ],
    moods: [
        { id: 'chill', name: 'Chill', emoji: '😌', description: 'Relaxed vibes' },
        { id: 'workout', name: 'Workout', emoji: '💪', description: 'High energy' },
        { id: 'party', name: 'Party', emoji: '🎉', description: 'Dance all night' },
        { id: 'focus', name: 'Focus', emoji: '🎯', description: 'Deep concentration' },
        { id: 'sleep', name: 'Sleep', emoji: '😴', description: 'Peaceful rest' },
        { id: 'romantic', name: 'Romantic', emoji: '❤️', description: 'Love songs' },
        { id: 'happy', name: 'Happy', emoji: '😊', description: 'Feel good' },
        { id: 'sad', name: 'Sad', emoji: '😢', description: 'Emotional' },
    ]
};

// Current onboarding state
let onboardingState = {
    currentStep: 1,
    totalSteps: 3,
    selectedLanguages: [],
    selectedGenres: [],
    selectedMoods: [],
};

/**
 * Show onboarding wizard
 */
function showOnboardingWizard() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('onboardingWizard');
    if (!modal) {
        modal = createOnboardingModal();
        document.body.appendChild(modal);
    }

    // Reset state
    onboardingState = {
        currentStep: 1,
        totalSteps: 3,
        selectedLanguages: [],
        selectedGenres: [],
        selectedMoods: [],
    };

    // Render step 1
    renderOnboardingStep(1);

    // Show modal
    setTimeout(() => {
        modal.classList.add('visible');
    }, 100);
}

/**
 * Close onboarding wizard
 */
function closeOnboardingWizard() {
    const modal = document.getElementById('onboardingWizard');
    if (modal) {
        modal.classList.remove('visible');
    }
}

/**
 * Create onboarding modal element
 */
function createOnboardingModal() {
    const modal = document.createElement('div');
    modal.id = 'onboardingWizard';
    modal.className = 'onboarding-wizard';
    modal.innerHTML = `
        <div class="onboarding-overlay" onclick=""></div>
        <div class="onboarding-content">
            <button class="onboarding-close" onclick="skipOnboarding()" aria-label="Skip">
                Skip
            </button>
            <div id="onboardingStepContent"></div>
        </div>
    `;
    return modal;
}

/**
 * Render onboarding step
 */
function renderOnboardingStep(step) {
    onboardingState.currentStep = step;
    const container = document.getElementById('onboardingStepContent');

    if (step === 1) {
        container.innerHTML = renderLanguageStep();
    } else if (step === 2) {
        container.innerHTML = renderGenreStep();
    } else if (step === 3) {
        container.innerHTML = renderMoodStep();
    }

    // Update progress
    updateProgress();
}

/**
 * Render language selection step
 */
function renderLanguageStep() {
    return `
        <div class="onboarding-step">
            <div class="onboarding-header">
                <h2>What languages do you listen to?</h2>
                <p>Select at least 1 language</p>
            </div>

            <div class="onboarding-grid">
                ${ONBOARDING_DATA.languages.map(lang => `
                    <button
                        class="onboarding-option ${onboardingState.selectedLanguages.includes(lang.code) ? 'selected' : ''}"
                        onclick="toggleLanguage('${lang.code}')"
                    >
                        <span class="option-emoji">${lang.emoji}</span>
                        <span class="option-name">${lang.name}</span>
                    </button>
                `).join('')}
            </div>

            <div class="onboarding-footer">
                <div class="onboarding-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 33%"></div>
                    </div>
                    <span class="progress-text">Step 1 of 3</span>
                </div>
                <button
                    class="onboarding-next ${onboardingState.selectedLanguages.length > 0 ? '' : 'disabled'}"
                    onclick="nextStep()"
                    ${onboardingState.selectedLanguages.length === 0 ? 'disabled' : ''}
                >
                    Next
                </button>
            </div>
        </div>
    `;
}

/**
 * Render genre selection step
 */
function renderGenreStep() {
    return `
        <div class="onboarding-step">
            <div class="onboarding-header">
                <h2>What genres do you love?</h2>
                <p>Select at least 1 genre</p>
            </div>

            <div class="onboarding-grid">
                ${ONBOARDING_DATA.genres.map(genre => `
                    <button
                        class="onboarding-option ${onboardingState.selectedGenres.includes(genre.id) ? 'selected' : ''}"
                        onclick="toggleGenre('${genre.id}')"
                    >
                        <span class="option-emoji">${genre.emoji}</span>
                        <span class="option-name">${genre.name}</span>
                    </button>
                `).join('')}
            </div>

            <div class="onboarding-footer">
                <div class="onboarding-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 66%"></div>
                    </div>
                    <span class="progress-text">Step 2 of 3</span>
                </div>
                <div class="onboarding-actions">
                    <button class="onboarding-back" onclick="previousStep()">
                        Back
                    </button>
                    <button
                        class="onboarding-next ${onboardingState.selectedGenres.length > 0 ? '' : 'disabled'}"
                        onclick="nextStep()"
                        ${onboardingState.selectedGenres.length === 0 ? 'disabled' : ''}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render mood selection step
 */
function renderMoodStep() {
    return `
        <div class="onboarding-step">
            <div class="onboarding-header">
                <h2>What's your vibe?</h2>
                <p>Select your favorite moods</p>
            </div>

            <div class="onboarding-grid mood-grid">
                ${ONBOARDING_DATA.moods.map(mood => `
                    <button
                        class="onboarding-option mood-option ${onboardingState.selectedMoods.includes(mood.id) ? 'selected' : ''}"
                        onclick="toggleMood('${mood.id}')"
                    >
                        <span class="option-emoji">${mood.emoji}</span>
                        <span class="option-name">${mood.name}</span>
                        <span class="option-desc">${mood.description}</span>
                    </button>
                `).join('')}
            </div>

            <div class="onboarding-footer">
                <div class="onboarding-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 100%"></div>
                    </div>
                    <span class="progress-text">Step 3 of 3</span>
                </div>
                <div class="onboarding-actions">
                    <button class="onboarding-back" onclick="previousStep()">
                        Back
                    </button>
                    <button
                        class="onboarding-finish ${onboardingState.selectedMoods.length > 0 ? '' : 'disabled'}"
                        onclick="completeOnboarding()"
                        ${onboardingState.selectedMoods.length === 0 ? 'disabled' : ''}
                    >
                        Finish
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Toggle language selection
 */
function toggleLanguage(code) {
    const index = onboardingState.selectedLanguages.indexOf(code);
    if (index > -1) {
        onboardingState.selectedLanguages.splice(index, 1);
    } else {
        onboardingState.selectedLanguages.push(code);
    }
    renderOnboardingStep(1);
}

/**
 * Toggle genre selection
 */
function toggleGenre(id) {
    const index = onboardingState.selectedGenres.indexOf(id);
    if (index > -1) {
        onboardingState.selectedGenres.splice(index, 1);
    } else {
        onboardingState.selectedGenres.push(id);
    }
    renderOnboardingStep(2);
}

/**
 * Toggle mood selection
 */
function toggleMood(id) {
    const index = onboardingState.selectedMoods.indexOf(id);
    if (index > -1) {
        onboardingState.selectedMoods.splice(index, 1);
    } else {
        onboardingState.selectedMoods.push(id);
    }
    renderOnboardingStep(3);
}

/**
 * Next step
 */
async function nextStep() {
    const { currentStep, selectedLanguages, selectedGenres } = onboardingState;

    // Validate current step
    if (currentStep === 1 && selectedLanguages.length === 0) {
        showToast('Please select at least 1 language');
        return;
    }

    if (currentStep === 2 && selectedGenres.length === 0) {
        showToast('Please select at least 1 genre');
        return;
    }

    // Save current step to backend
    try {
        const accessToken = localStorage.getItem('tldr-access-token');
        console.log('Access token from localStorage:', accessToken ? `${accessToken.substring(0, 20)}...` : 'NULL');

        if (!accessToken) {
            showToast('Please log in first');
            return;
        }

        if (currentStep === 1) {
            await saveLanguages(accessToken, selectedLanguages);
        } else if (currentStep === 2) {
            await saveGenres(accessToken, selectedGenres);
        }

        // Move to next step
        renderOnboardingStep(currentStep + 1);

    } catch (error) {
        console.error('Save step error:', error);
        showToast('Failed to save preferences');
    }
}

/**
 * Previous step
 */
function previousStep() {
    const { currentStep } = onboardingState;
    if (currentStep > 1) {
        renderOnboardingStep(currentStep - 1);
    }
}

/**
 * Complete onboarding
 */
async function completeOnboarding() {
    const { selectedMoods } = onboardingState;

    if (selectedMoods.length === 0) {
        showToast('Please select at least 1 mood');
        return;
    }

    try {
        const accessToken = localStorage.getItem('tldr-access-token');
        if (!accessToken) {
            showToast('Please log in first');
            return;
        }

        // Save moods
        await saveMoods(accessToken, selectedMoods);

        // Mark onboarding as complete
        await markOnboardingComplete(accessToken);

        // Update user in localStorage
        const userStr = localStorage.getItem('tldr-user');
        if (userStr) {
            const user = JSON.parse(userStr);
            user.onboarding_completed = true;
            user.preferences = {
                languages: onboardingState.selectedLanguages,
                genres: onboardingState.selectedGenres,
                moods: onboardingState.selectedMoods,
            };
            localStorage.setItem('tldr-user', JSON.stringify(user));
        }

        // Close wizard
        closeOnboardingWizard();

        // Show success message
        showToast('Preferences saved! Enjoy personalized music.');

    } catch (error) {
        console.error('Complete onboarding error:', error);
        showToast('Failed to complete onboarding');
    }
}

/**
 * Skip onboarding
 */
async function skipOnboarding() {
    try {
        const accessToken = localStorage.getItem('tldr-access-token');
        if (accessToken) {
            await fetch(`${ONBOARDING_CONFIG.API_BASE}/api/users/me/onboarding/skip`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
        }

        closeOnboardingWizard();
        showToast('You can set preferences anytime in your profile');

    } catch (error) {
        console.error('Skip onboarding error:', error);
        closeOnboardingWizard();
    }
}

/**
 * Save languages to backend
 */
async function saveLanguages(accessToken, languages) {
    const res = await fetch(`${ONBOARDING_CONFIG.API_BASE}/api/users/me/onboarding/languages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ languages })
    });

    if (!res.ok) {
        // Log detailed error information
        const errorText = await res.text();
        console.error('Save languages failed:', {
            status: res.status,
            statusText: res.statusText,
            headers: Object.fromEntries(res.headers.entries()),
            body: errorText
        });
        throw new Error(`Failed to save languages: ${res.status} ${errorText}`);
    }

    return await res.json();
}

/**
 * Save genres to backend
 */
async function saveGenres(accessToken, genres) {
    const res = await fetch(`${ONBOARDING_CONFIG.API_BASE}/api/users/me/onboarding/genres`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ genres })
    });

    if (!res.ok) {
        throw new Error('Failed to save genres');
    }

    return await res.json();
}

/**
 * Save moods to backend
 */
async function saveMoods(accessToken, moods) {
    const res = await fetch(`${ONBOARDING_CONFIG.API_BASE}/api/users/me/onboarding/moods`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ moods })
    });

    if (!res.ok) {
        throw new Error('Failed to save moods');
    }

    return await res.json();
}

/**
 * Mark onboarding as complete
 */
async function markOnboardingComplete(accessToken) {
    const res = await fetch(`${ONBOARDING_CONFIG.API_BASE}/api/users/me/onboarding/complete`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        throw new Error('Failed to complete onboarding');
    }

    return await res.json();
}

/**
 * Update progress bar
 */
function updateProgress() {
    const progress = (onboardingState.currentStep / onboardingState.totalSteps) * 100;
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

/**
 * Check if user needs onboarding
 */
function shouldShowOnboarding() {
    const userStr = localStorage.getItem('tldr-user');
    if (!userStr) return false;

    const user = JSON.parse(userStr);
    return !user.onboarding_completed;
}

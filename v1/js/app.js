// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const elements = {
        promptInput: document.getElementById('prompt-input'),
        randomizeBtn: document.getElementById('randomize-btn'),
        generateBtn: document.getElementById('generate-btn'),
        templateChips: document.querySelectorAll('.template-chip'),
        
        // Output Elements
        placeholderBox: document.getElementById('image-placeholder'),
        resultBox: document.getElementById('result-container'),
        generatedImage: document.getElementById('generated-image'),
        downloadBtn: document.getElementById('download-btn'),
        mainLoader: document.getElementById('main-loader'),
        errorPanel: document.getElementById('error-message'),
        errorText: document.getElementById('error-text'),
        rateLimitWarning: document.getElementById('rate-limit-warning'),
        
        // Modal Elements
        settingsBtn: document.getElementById('settings-btn'),
        configModal: document.getElementById('config-modal'),
        closeModalBtn: document.getElementById('close-config-btn'),
        byokInput: document.getElementById('byok-input'),
        saveKeyBtn: document.getElementById('save-key-btn'),
        clearKeyBtn: document.getElementById('clear-key-btn'),
        keyStatus: document.getElementById('key-status')
    };

    // Constants
    const baselinePrompt = "Philippines woman with robot face";
    const artisticStyles = [
        ", highly detailed, neon pink and cyan, cyberpunk aesthetic",
        ", ethereal lighting, glowing, mystical energy",
        ", vibrant colors, stained glass background, masterpiece",
        ", sleek futuristic metallic plating, cinematic 8k resolution",
        ", glitch art style, heavily stylized, digital overdrive",
        ", elegant gold and white filigree, serene expression",
        ", watercolor wash, expressive brushstrokes, dynamic pose"
    ];

    // Functions
    const getRandomPrompt = () => {
        const randomStyle = artisticStyles[Math.floor(Math.random() * artisticStyles.length)];
        return baselinePrompt + randomStyle;
    };

    const randomizeInput = () => {
        elements.promptInput.value = getRandomPrompt();
    };

    const setGeneratingState = (isGenerating) => {
        elements.generateBtn.disabled = isGenerating;
        elements.promptInput.disabled = isGenerating;
        
        if (isGenerating) {
            elements.errorPanel.classList.add('hidden');
            elements.rateLimitWarning.classList.add('hidden');
            elements.resultBox.classList.add('hidden');
            elements.placeholderBox.classList.remove('hidden');
            elements.placeholderBox.classList.add('generating');
            elements.mainLoader.classList.remove('hidden');
        } else {
            elements.placeholderBox.classList.remove('generating');
            elements.mainLoader.classList.add('hidden');
        }
    };

    const showError = (message) => {
        elements.errorText.textContent = message;
        elements.errorPanel.classList.remove('hidden');
        elements.placeholderBox.classList.remove('hidden');
        elements.resultBox.classList.add('hidden');
    };

    const showResult = (imageUrl) => {
        elements.generatedImage.src = imageUrl;
        // Setting up the download button to trigger download
        elements.downloadBtn.href = imageUrl;
        elements.downloadBtn.setAttribute('download', `cryptartist_${Date.now()}.png`);
        
        // Note: For cross-origin images (like from OpenAI/S3), 
        // downloading via purely `a[download]` might just open in new tab.
        // Opening in new tab is standard for remote assets without a proxy.
        // We add target blank fallback:
        elements.downloadBtn.target = '_blank';

        elements.placeholderBox.classList.add('hidden');
        elements.resultBox.classList.remove('hidden');
    };

    const handleGenerate = async () => {
        const promptText = elements.promptInput.value.trim();
        if (!promptText) {
            elements.promptInput.focus();
            return;
        }

        setGeneratingState(true);

        try {
            const imageUrl = await CryptArtistAPI.generateImage(promptText);
            showResult(imageUrl);
        } catch (error) {
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                elements.rateLimitWarning.classList.remove('hidden');
                showError("Developer API Key limit reached. Please set your own Settings to continue minting.");
            } else {
                showError("Error: " + error.message);
            }
        } finally {
            setGeneratingState(false);
        }
    };

    // Modal & Settings Logic
    const updateSettingsUI = () => {
        const hasKey = CryptArtistStorage.isUsingBYOK();
        if (hasKey) {
            elements.byokInput.value = 'sk-***********************************'; // Masked visual
            elements.clearKeyBtn.classList.remove('hidden');
            elements.keyStatus.textContent = 'Using your personal API key (Unlimited uses)';
            elements.keyStatus.className = 'status-message success';
        } else {
            elements.byokInput.value = '';
            elements.clearKeyBtn.classList.add('hidden');
            elements.keyStatus.textContent = 'Using developer free tier (Rate limited)';
            elements.keyStatus.className = 'status-message';
        }
    };

    const toggleModal = (show) => {
        if (show) {
            elements.configModal.classList.remove('hidden');
            updateSettingsUI();
        } else {
            elements.configModal.classList.add('hidden');
            elements.keyStatus.textContent = '';
        }
    };

    // Event Listeners
    elements.randomizeBtn.addEventListener('click', randomizeInput);
    
    // Allow Ctrl+Enter to generate
    elements.promptInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            handleGenerate();
        }
    });

    elements.generateBtn.addEventListener('click', handleGenerate);

    // Templates
    elements.templateChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            elements.promptInput.value = e.target.dataset.prompt;
        });
    });

    // Modal
    elements.settingsBtn.addEventListener('click', () => toggleModal(true));
    elements.closeModalBtn.addEventListener('click', () => toggleModal(false));
    
    // Close modal on click outside
    elements.configModal.addEventListener('click', (e) => {
        if (e.target === elements.configModal) {
            toggleModal(false);
        }
    });

    elements.saveKeyBtn.addEventListener('click', () => {
        const key = elements.byokInput.value.trim();
        // Super basic validation
        if (key && key.startsWith('sk-')) {
            CryptArtistStorage.setApiKey(key);
            updateSettingsUI();
            elements.keyStatus.textContent = 'Key saved successfully!';
            
            // Auto hide rate limits if they had one showing
            elements.rateLimitWarning.classList.add('hidden');
            if (elements.errorText.textContent.includes('limit reached')) {
                elements.errorPanel.classList.add('hidden');
            }
        } else if (key && key.startsWith('sk-********')) {
            // They just clicked save on the masked key, do nothing
             elements.keyStatus.textContent = 'Key is already set.';
        } else {
            elements.keyStatus.textContent = 'Please enter a valid OpenAI API key starting with "sk-"';
            elements.keyStatus.className = 'status-message error';
        }
    });

    elements.clearKeyBtn.addEventListener('click', () => {
        CryptArtistStorage.deleteApiKey();
        updateSettingsUI();
        elements.keyStatus.textContent = 'Key removed. Reverted to free tier.';
    });

    // Initialize
    randomizeInput(); // Set first random prompt
    updateSettingsUI();
});

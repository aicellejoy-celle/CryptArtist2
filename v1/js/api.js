// API wrapper for generating images
const CryptArtistAPI = {
    
    /**
     * Generate an image based on the prompt
     * @param {string} prompt The text prompt describing the image
     * @returns {Promise<string>} The URL of the generated image
     */
    generateImage: async function(prompt) {
        // Check if user has their own key
        const userKey = CryptArtistStorage.getApiKey();
        
        if (userKey) {
            // BYOK Mode: Call OpenAI API directly from browser
            return this._callOpenAIDirectly(prompt, userKey);
        } else {
            // Developer Key Mode: Call our Vercel Serverless Function
            return this._callServerlessProxy(prompt);
        }
    },

    /**
     * Private: Call direct OpenAI endpoints
     */
    _callOpenAIDirectly: async function(prompt, apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    response_format: "url"
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // OpenAI API errors (e.g. invalid key, quota exceeded)
                throw new Error(data.error?.message || "OpenAI API Error");
            }

            return data.data[0].url;

        } catch (error) {
            console.error("Direct API Error:", error);
            throw error;
        }
    },

    /**
     * Private: Call Vercel proxy endpoint with rate limiting
     */
    _callServerlessProxy: async function(prompt) {
        try {
            // Since our proxy is located at /api/generate
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: prompt })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("RATE_LIMIT_EXCEEDED");
                }
                throw new Error(data.error || "Serverless Proxy Error");
            }

            return data.url;

        } catch (error) {
            console.error("Proxy API Error:", error);
            throw error;
        }
    }
};

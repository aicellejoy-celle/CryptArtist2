// Utility for managing cookies for the BYOK (Bring Your Own Key) feature
// Because we don't have a backend DB or users, we just store it locally.

const CryptArtistStorage = {
    COOKIE_NAME: 'ca_user_api_key',
    COOKIE_DAYS: 30,

    /**
     * Get the stored API key from cookies
     * @returns {string|null} The API key or null if not found
     */
    getApiKey: function() {
        const nameEQ = this.COOKIE_NAME + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    /**
     * Save the API key to cookies
     * @param {string} value The API key to store
     */
    setApiKey: function(value) {
        let expires = "";
        const date = new Date();
        date.setTime(date.getTime() + (this.COOKIE_DAYS * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
        // Secure context if HTTPS
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = this.COOKIE_NAME + "=" + (value || "")  + expires + "; path=/; SameSite=Strict" + secure;
    },

    /**
     * Delete the stored API key
     */
    deleteApiKey: function() {
        document.cookie = this.COOKIE_NAME + '=; Max-Age=-99999999; path=/';
    },

    /**
     * Check if user is using BYOK mode
     * @returns {boolean}
     */
    isUsingBYOK: function() {
        return !!this.getApiKey();
    }
};

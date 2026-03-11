// Vercel Serverless Function
// Intercepts requests, checks rate limits, and safely calls OpenAI without exposing the key

// Simple in-memory store for rate limiting
// Note: In Vercel, this state resets on cold-starts. Good enough for basic protection.
const rateLimitStore = new Map();

// 24 Hour Limits Based on Quality Tier
const LIMITS = {
    'high': 1,
    'medium': 5,
    'low': 15
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, quality = 'medium' } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 1. Get Client IP for rate limiting
    // Vercel populates x-real-ip or x-forwarded-for
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown-ip';

    // Validate quality input
    const targetQuality = Object.keys(LIMITS).includes(quality) ? quality : 'medium';

    // 2. Check Rate Limits (24-hour window per tier)
    const isAllowed = checkRateLimit(clientIp, targetQuality);
    if (!isAllowed) {
        return res.status(429).json({ 
            error: `Rate limit exceeded for ${targetQuality} quality. Please use your own API key in Settings for unlimited mints.` 
        });
    }

    // 3. Call OpenAI securely
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("Server configuration error: Missing OPENAI_API_KEY");
        }

        // Standard or HD depending on requested quality tier
        const model = "dall-e-3";
        const opQuality = targetQuality === 'high' ? "hd" : "standard";

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: opQuality,
                response_format: "url" // We just want the URL, no base64 storage
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI Error:", data);
            return res.status(response.status).json({ 
                error: data.error?.message || "Error communicating with OpenAI" 
            });
        }

        // Return the image URL to the client
        return res.status(200).json({ url: data.data[0].url });

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

/**
 * Basic in-memory rate limiter based on IP and Quality Tier
 * @param {string} ip 
 * @param {string} qualityTier
 * @returns {boolean} true if allowed, false if limit exceeded
 */
function checkRateLimit(ip, qualityTier) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, { 'high': [], 'medium': [], 'low': [] });
    }

    let userHistory = rateLimitStore.get(ip);
    
    // Clean up old entries older than 24 hours across all tiers
    userHistory.high = userHistory.high.filter(timestamp => timestamp > oneDayAgo);
    userHistory.medium = userHistory.medium.filter(timestamp => timestamp > oneDayAgo);
    userHistory.low = userHistory.low.filter(timestamp => timestamp > oneDayAgo);

    // Check limit for requested tier
    const requestsLast24Hours = userHistory[qualityTier].length;
    const maxAllowed = LIMITS[qualityTier];

    if (requestsLast24Hours >= maxAllowed) {
        // Save cleaned history back before returning false
        rateLimitStore.set(ip, userHistory);
        return false;
    }

    // Allow request and add to history
    userHistory[qualityTier].push(now);
    rateLimitStore.set(ip, userHistory);
    
    return true;
}

// Vercel Serverless Function
// Intercepts requests, checks rate limits, and safely calls OpenAI without exposing the key

// Simple in-memory store for rate limiting
// Note: In Vercel, this state resets on cold-starts. Good enough for basic protection.
const rateLimitStore = new Map();

// Limits
const LIMITS = {
    PER_MINUTE: 1,
    PER_HOUR: 10
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // 1. Get Client IP for rate limiting
    // Vercel populates x-real-ip or x-forwarded-for
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown-ip';

    // 2. Check Rate Limits
    const isAllowed = checkRateLimit(clientIp);
    if (!isAllowed) {
        return res.status(429).json({ 
            error: 'Rate limit exceeded. Please use your own API key in Settings for unlimited mints.' 
        });
    }

    // 3. Call OpenAI securely
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("Server configuration error: Missing OPENAI_API_KEY");
        }

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
 * Basic in-memory rate limiter based on IP
 * @param {string} ip 
 * @returns {boolean} true if allowed, false if limit exceeded
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, [now]);
        return true;
    }

    let history = rateLimitStore.get(ip);
    
    // Clean up old entries
    history = history.filter(timestamp => timestamp > oneHourAgo);

    const requestsLastMinute = history.filter(t => t > oneMinuteAgo).length;
    const requestsLastHour = history.length;

    if (requestsLastMinute >= LIMITS.PER_MINUTE || requestsLastHour >= LIMITS.PER_HOUR) {
        // Save the cleaned history back
        rateLimitStore.set(ip, history);
        return false;
    }

    // Allow request and add to history
    history.push(now);
    rateLimitStore.set(ip, history);
    
    return true;
}

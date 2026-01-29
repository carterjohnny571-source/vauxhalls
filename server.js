const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'users.json');

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

// Track online users
let onlineUsers = new Map(); // odekic id -> username

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

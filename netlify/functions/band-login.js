const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        if (!username || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Username and password are required' })
            };
        }

        // Find band by username
        const bandsSnapshot = await db.ref('bands').once('value');
        const bands = bandsSnapshot.val() || {};

        let foundBand = null;
        for (const bandId in bands) {
            if (bands[bandId].username.toLowerCase() === username.trim().toLowerCase()) {
                foundBand = bands[bandId];
                break;
            }
        }

        if (!foundBand) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid username or password' })
            };
        }

        // Verify password
        if (!verifyPassword(password, foundBand.passwordHash)) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Invalid username or password' })
            };
        }

        // Check approval status
        if (foundBand.status !== 'approved') {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    error: 'Your account is pending approval. Please wait for an admin to approve your registration.'
                })
            };
        }

        // Update last login
        await db.ref(`bands/${foundBand.bandId}/lastLogin`).set(new Date().toISOString());

        // Generate JWT token (expires in 7 days)
        const token = jwt.sign(
            { bandId: foundBand.bandId, username: foundBand.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                token,
                band: {
                    bandId: foundBand.bandId,
                    username: foundBand.username,
                    status: foundBand.status
                }
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Login failed. Please try again.' })
        };
    }
};

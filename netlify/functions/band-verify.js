const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

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

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'No token provided' })
            };
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get band from Firebase
        const bandSnapshot = await db.ref(`bands/${decoded.bandId}`).once('value');
        const band = bandSnapshot.val();

        if (!band) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Band not found' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                valid: true,
                band: {
                    bandId: band.bandId,
                    username: band.username,
                    status: band.status
                }
            })
        };

    } catch (error) {
        console.error('Verify error:', error);
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid token' })
        };
    }
};

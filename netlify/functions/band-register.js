const nodemailer = require('nodemailer');

// Firebase Admin SDK for server-side operations
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

// Simple password hashing (using built-in crypto for serverless)
const crypto = require('crypto');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

exports.handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { username, email, password } = JSON.parse(event.body);

        // Validate input
        if (!username || !email || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Username, email, and password are required' })
            };
        }

        if (username.trim().length < 1 || username.trim().length > 30) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Band name must be 1-30 characters' })
            };
        }

        if (password.length < 8) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Password must be at least 8 characters' })
            };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid email address' })
            };
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Check if username or email already exists in Firebase
        const bandsSnapshot = await db.ref('bands').once('value');
        const bands = bandsSnapshot.val() || {};

        for (const bandId in bands) {
            if (bands[bandId].username.toLowerCase() === cleanUsername.toLowerCase()) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Band name already registered' })
                };
            }
            if (bands[bandId].email.toLowerCase() === cleanEmail) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Email already registered' })
                };
            }
        }

        // Hash password and generate IDs
        const passwordHash = hashPassword(password);
        const bandId = 'band_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        const approvalToken = 'approve_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');

        // Create band record
        const band = {
            bandId,
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            createdAt: new Date().toISOString(),
            status: 'pending',
            approvedAt: null,
            approvalToken
        };

        // Save to Firebase
        await db.ref(`bands/${bandId}`).set(band);
        await db.ref(`approvalTokens/${approvalToken}`).set(bandId);

        // Send approval email
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            const approvalLink = `${process.env.URL || 'https://vauxhalls.info'}/.netlify/functions/band-approve?token=${approvalToken}`;

            await transporter.sendMail({
                from: `"The Vauxhalls Website" <${process.env.SMTP_USER}>`,
                to: process.env.ADMIN_EMAIL,
                subject: `[Band Registration] ${cleanUsername} requests approval`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #3b5998;">New Band Registration Request</h2>
                        <p>A new band has registered and is awaiting your approval:</p>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Band Name:</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${cleanUsername}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Email:</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${cleanEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; background: #f5f5f5;">Registered:</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
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
                    </div>
                `
            });
            console.log(`Approval email sent for band: ${cleanUsername}`);
        } catch (emailError) {
            console.error('Failed to send approval email:', emailError.message);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Registration submitted! You will be able to log in once an admin approves your account.'
            })
        };

    } catch (error) {
        console.error('Registration error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Registration failed. Please try again.' })
        };
    }
};

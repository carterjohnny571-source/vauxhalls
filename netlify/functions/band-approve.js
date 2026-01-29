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
    const token = event.queryStringParameters?.token;

    if (!token) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html' },
            body: `
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
                    <h1>Invalid Link</h1>
                    <p>No approval token provided.</p>
                </body>
                </html>
            `
        };
    }

    try {
        // Get band ID from approval token
        const tokenSnapshot = await db.ref(`approvalTokens/${token}`).once('value');
        const bandId = tokenSnapshot.val();

        if (!bandId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html' },
                body: `
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
                `
            };
        }

        // Get band
        const bandSnapshot = await db.ref(`bands/${bandId}`).once('value');
        const band = bandSnapshot.val();

        if (!band) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'text/html' },
                body: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Band Not Found</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
                            h1 { color: #d9534f; }
                            p { color: #ccc; }
                        </style>
                    </head>
                    <body>
                        <h1>Band Not Found</h1>
                        <p>The band associated with this link no longer exists.</p>
                    </body>
                    </html>
                `
            };
        }

        if (band.status === 'approved') {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `
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
                `
            };
        }

        // Approve the band
        await db.ref(`bands/${bandId}`).update({
            status: 'approved',
            approvedAt: new Date().toISOString()
        });

        // Remove the approval token
        await db.ref(`approvalTokens/${token}`).remove();

        console.log(`Band approved: ${band.username}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
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
            `
        };

    } catch (error) {
        console.error('Approval error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Error</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #fff; }
                        h1 { color: #d9534f; }
                        p { color: #ccc; }
                    </style>
                </head>
                <body>
                    <h1>Error</h1>
                    <p>Something went wrong. Please try again.</p>
                </body>
                </html>
            `
        };
    }
};

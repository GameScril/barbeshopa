const fs = require('fs');
const dotenv = require('dotenv');
const https = require('https');
const { google } = require('googleapis');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
} else {
    dotenv.config({ path: '.env.example' });
}

function getRequiredEnv(name) {
    const value = process.env[name] && String(process.env[name]).trim();
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }

    return value;
}

function buildOAuthClient() {
    return new google.auth.OAuth2(
        getRequiredEnv('GOOGLE_CLIENT_ID'),
        getRequiredEnv('GOOGLE_CLIENT_SECRET'),
        getRequiredEnv('GOOGLE_REDIRECT_URI')
    );
}

function exchangeCodeForToken(code) {
    const clientId = getRequiredEnv('GOOGLE_CLIENT_ID');
    const clientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET');
    const redirectUri = getRequiredEnv('GOOGLE_REDIRECT_URI');
    const authCode = code && String(code).trim();

    if (!authCode) {
        throw new Error('Missing authorization code');
    }

    const requestBody = new URLSearchParams({
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
    }).toString();

    return new Promise((resolve, reject) => {
        const request = https.request(
            'https://oauth2.googleapis.com/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            },
            response => {
                let responseText = '';

                response.on('data', chunk => {
                    responseText += chunk;
                });

                response.on('end', () => {
                    let parsedBody = {};

                    try {
                        parsedBody = responseText ? JSON.parse(responseText) : {};
                    } catch (parseError) {
                        parsedBody = { raw: responseText, parseError: parseError.message };
                    }

                    if (response.statusCode && response.statusCode >= 400) {
                        return reject({
                            statusCode: response.statusCode,
                            data: parsedBody
                        });
                    }

                    resolve(parsedBody);
                });
            }
        );

        request.on('error', reject);
        request.write(requestBody);
        request.end();
    });
}

async function main() {
    const mode = process.argv[2];

    try {
        if (mode === 'url') {
            const oauth2Client = buildOAuthClient();
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/calendar'],
                prompt: 'consent'
            });

            console.log(authUrl);
            return;
        }

        if (mode === 'token') {
            const code = process.argv[3];
            const tokenData = await exchangeCodeForToken(code);

            console.log(JSON.stringify(tokenData, null, 2));
            return;
        }

        console.log('Usage:');
        console.log('  node scripts/google-auth.js url');
        console.log('  node scripts/google-auth.js token <authorization_code>');
    } catch (error) {
        console.error(error.message || error);
        if (error.data) {
            console.error(JSON.stringify(error.data, null, 2));
        }
        process.exitCode = 1;
    }
}

main();
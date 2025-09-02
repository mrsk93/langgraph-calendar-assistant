import express from 'express';
import { google } from 'googleapis';

const app = express();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
);

app.get('/auth', (req, res) => {
    // generate the link
    const scopes = ['https://www.googleapis.com/auth/calendar'];

    const url = oauth2Client.generateAuthUrl({
        // 'online' (default) or 'offline' (gets refresh_token)
        access_type: 'offline',
        prompt: 'consent',
        // If you only need one scope, you can pass it as a string
        scope: scopes,
    });

    console.log('url', url);

    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code as string;

    const { tokens } = await oauth2Client.getToken(code);

    console.log(tokens);

    res.send('Connected ✅ You can close this tab now.');
});

app.listen(3600, () => console.log(`Server is running on port 3600`));
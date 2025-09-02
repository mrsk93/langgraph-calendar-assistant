import { tool } from '@langchain/core/tools';
import { google } from 'googleapis';
import { z } from 'zod';

// Set up Google Calendar API client

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
);

oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

export const getEventsTool = tool(async ({q, timeMin, timeMax}: {q: string, timeMin: string, timeMax: string}) => {
    try {
        const res = await calendar.events.list({
            calendarId: 'primary',
            q,
            timeMin: new Date(timeMin).toISOString(),
            timeMax: new Date(timeMax).toISOString(),
        });
        const events = res.data.items;
        return JSON.stringify(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        return `Error occurred fetching events`;
    }
}, {
    name: 'getGoogleCalendarEvents',
    description: 'Get a list of user meetings in google Calendar',
    schema: z.object({
        q: z.string().optional().describe("The title or description of the event to search for"),
        timeMin: z.string().optional().describe("The start time in ISO format"),
        timeMax: z.string().optional().describe("The end time in ISO format"),
    })
})
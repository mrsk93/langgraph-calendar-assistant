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

export const getEventsTool = tool(async ({ q, timeMin, timeMax }: { q: string, timeMin: string, timeMax: string }) => {
    try {
        console.log('Fetching events from Google Calendar...');
        const res = await calendar.events.list({
            calendarId: 'primary',
            q,
            timeMin: new Date(timeMin).toISOString(),
            timeMax: new Date(timeMax).toISOString(),
        });
        const events = res.data.items?.map((event) => {
            return {
                id: event.id,
                summary: event.summary,
                status: event.status,
                organizer: event.organizer,
                start: event.start,
                end: event.end,
                attendees: event.attendees,
                meetingLink: event.hangoutLink,
                eventType: event.eventType,
            };
        });;
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
        timeMin: z.string().describe("The start time in ISO format"),
        timeMax: z.string().describe("The end time in ISO format"),
    })
});


export const createEventTool = tool(async ({ summary, start, end, attendees }: {
    summary: string,
    start: { dateTime: string, timeZone: string },
    end: { dateTime: string, timeZone: string },
    attendees: { email: string, displayName: string }[]
}) => {
    try {
        console.log('Creating event in Google Calendar...');
        const response = await calendar.events.insert({
            calendarId: 'primary',
            sendUpdates: 'all',
            conferenceDataVersion: 1,
            requestBody: {
                summary,
                start: {
                    dateTime: start.dateTime,
                    timeZone: start.timeZone,
                },
                end: {
                    dateTime: end.dateTime,
                    timeZone: end.timeZone,
                },
                attendees: attendees.map(attendee => ({
                    email: attendee.email,
                    displayName: attendee.displayName,
                })),
                conferenceData: {
                    createRequest: {
                        requestId: crypto.randomUUID(),
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet',
                        },
                    },
                },
            },
        });

        if (response.statusText === 'OK') {
            return 'The meeting has been created.';
        }

        return "Couldn't create a meeting.";
    } catch (error) {
        return "Couldn't create a meeting.";
    }
},
    {
        name: 'createGoogleCalendarEvents',
        description: 'Create a meeting in google Calendar',
        schema: z.object({
            summary: z.string().describe('The title of the event'),
            start: z.object({
                dateTime: z.string().describe('The date time of start of the event.'),
                timeZone: z.string().describe('Current IANA timezone string.'),
            }),
            end: z.object({
                dateTime: z.string().describe('The date time of end of the event.'),
                timeZone: z.string().describe('Current IANA timezone string.'),
            }),
            attendees: z.array(
                z.object({
                    email: z.string().describe('The email of the attendee'),
                    displayName: z.string().describe('Then name of the attendee.'),
                })
            ),
        }),
    }
);
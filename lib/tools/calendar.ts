import { google } from "googleapis";
import { createOAuth2Client } from "@/lib/google";

function getCalendarClient(accessToken: string, refreshToken: string) {
  const auth = createOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

export async function listEvents(
  accessToken: string,
  refreshToken: string,
  maxResults = 10,
  timeMin?: string,
) {
  const calendar = getCalendarClient(accessToken, refreshToken);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin ?? new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    description: e.description,
    attendees: e.attendees?.map((a) => a.email) ?? [],
  }));
}

export async function createEvent(
  accessToken: string,
  refreshToken: string,
  summary: string,
  startDateTime: string,
  endDateTime: string,
  description?: string,
  attendees?: string[],
) {
  const calendar = getCalendarClient(accessToken, refreshToken);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      attendees: attendees?.map((email) => ({ email })) ?? [],
    },
  });

  return {
    id: res.data.id,
    summary: res.data.summary,
    start: res.data.start?.dateTime,
    end: res.data.end?.dateTime,
    htmlLink: res.data.htmlLink,
    message: "Event created successfully.",
  };
}

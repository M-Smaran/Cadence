import { google } from "googleapis";
import { createOAuth2Client } from "@/lib/google";

function getGmailClient(accessToken: string, refreshToken: string) {
  const auth = createOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

export async function searchEmails(
  accessToken: string,
  refreshToken: string,
  query: string,
  maxResults = 10,
) {
  const gmail = getGmailClient(accessToken, refreshToken);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  const messages = res.data.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      }),
    ),
  );

  return details.map((d) => {
    const headers = d.data.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name === name)?.value ?? "";
    return {
      id: d.data.id,
      subject: get("Subject"),
      from: get("From"),
      date: get("Date"),
      snippet: d.data.snippet,
    };
  });
}

export async function readEmail(
  accessToken: string,
  refreshToken: string,
  emailId: string,
) {
  const gmail = getGmailClient(accessToken, refreshToken);
  const res = await gmail.users.messages.get({
    userId: "me",
    id: emailId,
    format: "full",
  });

  const headers = res.data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name === name)?.value ?? "";

  const getBody = (payload: typeof res.data.payload): string => {
    if (!payload) return "";
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    for (const part of payload.parts ?? []) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    return res.data.snippet ?? "";
  };

  return {
    id: res.data.id,
    subject: get("Subject"),
    from: get("From"),
    to: get("To"),
    date: get("Date"),
    body: getBody(res.data.payload),
  };
}

export async function createDraft(
  accessToken: string,
  refreshToken: string,
  to: string,
  subject: string,
  body: string,
) {
  const gmail = getGmailClient(accessToken, refreshToken);
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });
  return { draftId: res.data.id, message: "Draft created successfully." };
}

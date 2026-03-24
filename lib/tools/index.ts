import OpenAI from "openai";
import { searchEmails, readEmail, createDraft } from "./gmail";
import { listEvents, createEvent } from "./calendar";
import { listBookings, getAvailability } from "./calcom";
import { decrypt } from "@/lib/encryption";
import { createTask } from "@/db/queries";

export type ToolContext = {
  gmailToken?: { accessToken: string; refreshToken: string };
  calendarToken?: { accessToken: string; refreshToken: string };
  calcomApiKey?: string;
  userId?: string;
};

export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Save a task or action item to the user's task list.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: { type: "string", description: "Optional detail or context" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          dueDate: { type: "string", description: "Optional ISO 8601 due date" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emails",
      description: "Search emails in Gmail using a query string.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Gmail search query, e.g. 'from:boss@company.com is:unread'" },
          maxResults: { type: "number", description: "Max number of results (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description: "Read the full content of an email by its ID.",
      parameters: {
        type: "object",
        properties: {
          emailId: { type: "string", description: "The Gmail message ID" },
        },
        required: ["emailId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_draft",
      description: "Create an email draft in Gmail.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email body (plain text)" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List upcoming Google Calendar events.",
      parameters: {
        type: "object",
        properties: {
          maxResults: { type: "number", description: "Max number of events (default 10)" },
          timeMin: { type: "string", description: "ISO 8601 start time filter (default: now)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new Google Calendar event.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title" },
          startDateTime: { type: "string", description: "Start time in ISO 8601 format" },
          endDateTime: { type: "string", description: "End time in ISO 8601 format" },
          description: { type: "string", description: "Optional event description" },
          attendees: { type: "array", items: { type: "string" }, description: "Optional list of attendee emails" },
        },
        required: ["summary", "startDateTime", "endDateTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_bookings",
      description: "List upcoming Cal.com bookings.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_availability",
      description: "Check Cal.com availability for an event type.",
      parameters: {
        type: "object",
        properties: {
          eventTypeId: { type: "number", description: "Cal.com event type ID" },
          dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
          dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["eventTypeId", "dateFrom", "dateTo"],
      },
    },
  },
];

export function getAvailableTools(ctx: ToolContext): OpenAI.Chat.ChatCompletionTool[] {
  return toolDefinitions.filter((t) => {
    if (t.type !== "function") return false;
    const name = (t as OpenAI.Chat.ChatCompletionTool & { type: "function" }).function.name;
    if (name === "create_task") return !!ctx.userId;
    if (["search_emails", "read_email", "create_draft"].includes(name)) return !!ctx.gmailToken;
    if (["list_calendar_events", "create_calendar_event"].includes(name)) return !!ctx.calendarToken;
    if (["list_bookings", "get_availability"].includes(name)) return !!ctx.calcomApiKey;
    return false;
  });
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "create_task":
      if (!ctx.userId) throw new Error("User context missing.");
      return createTask({
        userId: ctx.userId,
        title: args.title as string,
        description: args.description as string | undefined,
        priority: (args.priority as "low" | "medium" | "high") ?? "medium",
        dueDate: args.dueDate ? new Date(args.dueDate as string) : null,
        createdByAgent: true,
      });

    case "search_emails":
      if (!ctx.gmailToken) throw new Error("Gmail not connected.");
      return searchEmails(
        ctx.gmailToken.accessToken,
        ctx.gmailToken.refreshToken,
        args.query as string,
        (args.maxResults as number) ?? 10,
      );

    case "read_email":
      if (!ctx.gmailToken) throw new Error("Gmail not connected.");
      return readEmail(
        ctx.gmailToken.accessToken,
        ctx.gmailToken.refreshToken,
        args.emailId as string,
      );

    case "create_draft":
      if (!ctx.gmailToken) throw new Error("Gmail not connected.");
      return createDraft(
        ctx.gmailToken.accessToken,
        ctx.gmailToken.refreshToken,
        args.to as string,
        args.subject as string,
        args.body as string,
      );

    case "list_calendar_events":
      if (!ctx.calendarToken) throw new Error("Google Calendar not connected.");
      return listEvents(
        ctx.calendarToken.accessToken,
        ctx.calendarToken.refreshToken,
        (args.maxResults as number) ?? 10,
        args.timeMin as string | undefined,
      );

    case "create_calendar_event":
      if (!ctx.calendarToken) throw new Error("Google Calendar not connected.");
      return createEvent(
        ctx.calendarToken.accessToken,
        ctx.calendarToken.refreshToken,
        args.summary as string,
        args.startDateTime as string,
        args.endDateTime as string,
        args.description as string | undefined,
        args.attendees as string[] | undefined,
      );

    case "list_bookings":
      if (!ctx.calcomApiKey) throw new Error("Cal.com not connected.");
      return listBookings(ctx.calcomApiKey);

    case "get_availability":
      if (!ctx.calcomApiKey) throw new Error("Cal.com not connected.");
      return getAvailability(
        ctx.calcomApiKey,
        args.eventTypeId as number,
        args.dateFrom as string,
        args.dateTo as string,
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function buildToolContext(
  integrations: { provider: string; accessToken: string; refreshToken: string }[],
  preferences: Record<string, string>,
  userId?: string,
): ToolContext {
  const ctx: ToolContext = { userId };

  const gmail = integrations.find((i) => i.provider === "gmail");
  if (gmail) {
    ctx.gmailToken = {
      accessToken: decrypt(gmail.accessToken),
      refreshToken: decrypt(gmail.refreshToken),
    };
  }

  const calendar = integrations.find((i) => i.provider === "google_calendar");
  if (calendar) {
    ctx.calendarToken = {
      accessToken: decrypt(calendar.accessToken),
      refreshToken: decrypt(calendar.refreshToken),
    };
  }

  if (preferences.calcomApiKey) {
    ctx.calcomApiKey = decrypt(preferences.calcomApiKey);
  }

  return ctx;
}

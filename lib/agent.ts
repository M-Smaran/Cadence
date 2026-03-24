import OpenAI from "openai";
import {
  completeAgentRun,
  createAgentRun,
  getUserByClerkId,
  getUserIntegrations,
} from "@/db/queries";
import { ActionLogEntry } from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import { buildToolContext, executeTool, getAvailableTools } from "@/lib/tools";

const SYSTEM_PROMPT = `You are an autonomous executive assistant running a scheduled background job for the user.

Your mission — work through it fully before finishing:
1. Search Gmail for unread emails (query: "is:unread"). Process up to 15.
2. For each email: read it fully, then decide:
   - Does it need a reply? → create a draft reply via create_draft.
   - Does it contain action items or tasks? → save each via create_task.
   - Does it reference a meeting or event? → create a calendar event via create_calendar_event.
3. List the next 7 days of Google Calendar events and flag any conflicts or overloaded days.
4. If Cal.com is connected, list upcoming bookings and note any that clash with calendar events.
5. When all emails are processed, call finish_run with a concise summary and the structured log.

Rules:
- Be thorough — do not stop after the first email.
- Never make up information. Only act on what you read.
- Keep draft replies professional and concise.
- Task titles must be actionable (start with a verb).
- Today's date/time is: {{NOW}}.`;

interface FinishRunArgs {
  summary: string;
  log: ActionLogEntry[];
}

// The finish_run tool signals the agent is done and provides structured output
const finishRunTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "finish_run",
    description: "Call this when all work is complete to record the run summary and action log.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2–4 sentence plain-text summary of what was done." },
        log: {
          type: "array",
          description: "One entry per processed email.",
          items: {
            type: "object",
            properties: {
              emailId: { type: "string" },
              subject: { type: "string" },
              from: { type: "string" },
              date: { type: "string" },
              status: { type: "string", enum: ["success", "error"] },
              summary: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              category: { type: "string" },
              needsReply: { type: "boolean" },
              draftReply: { type: "string" },
              tasksCreated: { type: "number" },
              draftCreated: { type: "boolean" },
              eventsCreated: { type: "number" },
              error: { type: "string" },
            },
            required: ["emailId", "subject", "from", "date", "status"],
          },
        },
      },
      required: ["summary", "log"],
    },
  },
};

export async function runAgent(userId: string) {
  const startedAt = Date.now();
  const run = await createAgentRun(userId);

  try {
    // Load user data
    const integrations = await getUserIntegrations(userId);

    // Find user record to get preferences (openaiApiKey, calcomApiKey)
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) throw new Error("User not found");

    const prefs = (user.preferences as Record<string, string>) ?? {};
    if (!prefs.openaiApiKey) throw new Error("OpenAI API key not configured.");

    const apiKey = decrypt(prefs.openaiApiKey);
    const toolCtx = buildToolContext(
      integrations.map((i) => ({
        provider: i.provider,
        accessToken: i.accessToken,
        refreshToken: i.refreshToken,
      })),
      prefs,
      userId,
    );

    const availableTools = [
      ...getAvailableTools(toolCtx),
      finishRunTool,
    ];

    const client = new OpenAI({ apiKey });
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT.replace("{{NOW}}", new Date().toISOString()),
      },
      {
        role: "user",
        content: "Please run your full email processing and task management routine now.",
      },
    ];

    let finishArgs: FinishRunArgs | null = null;
    const MAX_ITERATIONS = 30;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        stream: false,
        tools: availableTools,
        tool_choice: "auto",
        messages,
      });

      const choice = response.choices[0];
      messages.push(choice.message);

      if (choice.finish_reason !== "tool_calls") break;

      const toolCalls = choice.message.tool_calls ?? [];
      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (call as any).function as { name: string; arguments: string };
        const args = JSON.parse(fn.arguments);

        // finish_run ends the loop
        if (fn.name === "finish_run") {
          finishArgs = args as FinishRunArgs;
          toolResults.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ ok: true }),
          });
          messages.push(...toolResults);
          break;
        }

        let result: unknown;
        try {
          result = await executeTool(fn.name, args, toolCtx);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }

        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      messages.push(...toolResults.filter((_, idx) =>
        // avoid duplicating the finish_run result we already pushed
        !(finishArgs && idx === toolResults.length - 1 && toolResults.length > 0)
      ));

      if (finishArgs) break;
    }

    const log: ActionLogEntry[] = finishArgs?.log ?? [];
    const summary = finishArgs?.summary ?? "Agent run completed.";

    const emailsProcessed = log.length;
    const tasksCreated = log.reduce((acc, e) => acc + (e.tasksCreated ?? 0), 0);
    const draftsCreated = log.filter((e) => e.draftCreated).length;

    await completeAgentRun(run.id, {
      status: "success",
      summary,
      actionsLog: log,
      emailsProcessed,
      tasksCreated,
      draftsCreated,
      durationMs: Date.now() - startedAt,
    });

    return { status: "success", summary, emailsProcessed, tasksCreated, draftsCreated };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await completeAgentRun(run.id, {
      status: "failed",
      summary: "Agent run failed.",
      actionsLog: [],
      emailsProcessed: 0,
      tasksCreated: 0,
      draftsCreated: 0,
      errorMessage,
      durationMs: Date.now() - startedAt,
    });
    return { status: "failed", summary: errorMessage };
  }
}

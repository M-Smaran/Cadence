import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { decrypt } from "@/lib/encryption";
import { getChatHistory, getOrCreateUser, getUserIntegrations, saveChatMessage } from "@/db/queries";
import { buildToolContext, executeTool, getAvailableTools } from "@/lib/tools";

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
  const name = clerkUser?.fullName ?? "";
  const user = await getOrCreateUser(clerkId, email, name);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const prefs = (user.preferences as Record<string, string>) ?? {};
  if (!prefs.openaiApiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not set. Add it in Settings." },
      { status: 400 },
    );
  }

  const apiKey = decrypt(prefs.openaiApiKey);
  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  await saveChatMessage(user.id, "user", message);

  const history = await getChatHistory(user.id, 40);
  const userIntegrations = await getUserIntegrations(user.id);

  const toolCtx = buildToolContext(
    userIntegrations.map((i) => ({
      provider: i.provider,
      accessToken: i.accessToken,
      refreshToken: i.refreshToken,
    })),
    prefs,
    user.id,
  );

  const availableTools = getAvailableTools(toolCtx);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a helpful AI executive assistant integrated into ExecOS. Today is ${new Date().toISOString()}. You have access to the user's Gmail, Google Calendar, and Cal.com. Use tools proactively to answer questions and complete tasks.`,
    },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const client = new OpenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";

      try {
        // Agentic loop — keep going while GPT wants to call tools
        while (true) {
          const response = await client.chat.completions.create({
            model: "gpt-4o",
            stream: false,
            tools: availableTools.length > 0 ? availableTools : undefined,
            tool_choice: availableTools.length > 0 ? "auto" : undefined,
            messages,
          });

          const choice = response.choices[0];

          if (choice.finish_reason === "tool_calls") {
            const toolCalls = choice.message.tool_calls ?? [];
            messages.push(choice.message);

            // Execute each tool call and collect results
            const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
            for (const call of toolCalls) {
              if (call.type !== "function") continue;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fn = (call as any).function as { name: string; arguments: string };
              const toolName = fn.name;
              const toolArgs = JSON.parse(fn.arguments);

              // Stream a small status hint
              const hint = `\n_Using tool: ${toolName}..._\n`;
              controller.enqueue(encoder.encode(hint));
              fullText += hint;

              let result: unknown;
              try {
                result = await executeTool(toolName, toolArgs, toolCtx);
              } catch (err) {
                result = { error: err instanceof Error ? err.message : String(err) };
              }

              toolResults.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(result),
              });
            }

            messages.push(...toolResults);
            continue; // Loop again with tool results
          }

          // Final text response — stream it
          const finalText = choice.message.content ?? "";
          if (finalText) {
            // Stream in chunks for a natural feel
            const chunkSize = 20;
            for (let i = 0; i < finalText.length; i += chunkSize) {
              controller.enqueue(encoder.encode(finalText.slice(i, i + chunkSize)));
            }
            fullText += finalText;
          }
          break;
        }

        await saveChatMessage(user.id, "assistant", fullText);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
